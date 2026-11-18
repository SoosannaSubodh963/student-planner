/* ==========================================================================
   admin-assignments.js — monitor assignment submissions across students
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;
  var state = { q: '', student: '', subject: '', status: '' };

  function fillSelects(list) {
    var st = $('#fStudent'), sj = $('#fSubject'), curS = st.value, curJ = sj.value;
    var students = getData('students', []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    st.innerHTML = '<option value="">All students</option>' + students.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
    var subs = {}; list.forEach(function (a) { if (a.subject) subs[a.subject] = 1; });
    sj.innerHTML = '<option value="">All subjects</option>' + Object.keys(subs).sort().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
    st.value = students.some(function (s) { return s.id === curS; }) ? curS : '';
    sj.value = subs[curJ] ? curJ : '';
    state.student = st.value; state.subject = sj.value;
  }

  function matches(a) {
    var q = state.q.toLowerCase();
    if (q && (a.title + ' ' + a.subject + ' ' + studentName(a.studentId) + ' ' + (a.description || '')).toLowerCase().indexOf(q) === -1) return false;
    if (state.student && a.studentId !== state.student) return false;
    if (state.subject && a.subject !== state.subject) return false;
    if (state.status === 'Overdue') return asgIsOverdue(a);
    if (state.status === 'Pending') return a.status !== 'Submitted' && !asgIsOverdue(a);
    if (state.status && a.status !== state.status) return false;
    return true;
  }

  function render() {
    var all = getData('assignments', []);
    fillSelects(all);
    var list = all.filter(matches).sort(function (a, b) { return (a.deadline || '').localeCompare(b.deadline || ''); });
    var s = asgStats(list);

    $('#stats').innerHTML = [
      ['fa-file-lines', 'ic-purple', s.total, 'Assignments'],
      ['fa-circle-check', 'ic-green', s.submitted, 'Submitted'],
      ['fa-hourglass-half', 'ic-blue', s.pending, 'Pending'],
      ['fa-triangle-exclamation', 'ic-red', s.overdue, 'Overdue'],
      ['fa-percent', 'ic-amber', s.rate + '%', 'Completion rate']
    ].map(function (c) { return '<div class="card stat-card"><div class="stat-icon ' + c[1] + '"><i class="fa-solid ' + c[0] + '"></i></div><div><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div>'; }).join('');

    // completion statistics per subject for the current selection
    var bySubject = {};
    list.forEach(function (a) { var k = a.subject || 'Other'; bySubject[k] = bySubject[k] || { t: 0, d: 0 }; bySubject[k].t++; if (a.status === 'Submitted') bySubject[k].d++; });
    var rows = Object.keys(bySubject).sort(function (x, y) { return bySubject[y].t - bySubject[x].t; }).slice(0, 6);
    $('#completion').innerHTML = '<div style="margin-bottom:18px"><div class="flex between" style="margin-bottom:6px"><b>Overall submission rate</b><b>' + s.rate + '%</b></div><div class="progress green"><div style="width:' + s.rate + '%"></div></div><div class="muted small" style="margin-top:6px">' + s.submitted + ' of ' + s.total + ' assignments submitted</div></div>' +
      (rows.length ? rows.map(function (k) {
        var r = Math.round(bySubject[k].d / bySubject[k].t * 100);
        return '<div class="rate-cell" style="margin-bottom:10px"><span style="min-width:150px" class="truncate">' + esc(k) + '</span><div class="progress thin"><div style="width:' + r + '%"></div></div><b>' + r + '%</b></div>';
      }).join('') : '<div class="muted">No assignments match the current filters.</div>');

    doughnutChart('asgSplit', ['Submitted', 'In progress', 'Not started', 'Overdue'], [
      s.submitted,
      list.filter(function (x) { return x.status === 'In Progress' && !asgIsOverdue(x); }).length,
      list.filter(function (x) { return x.status === 'Not Started' && !asgIsOverdue(x); }).length,
      s.overdue
    ], ['#10b981', '#f59e0b', '#60a5fa', '#ef4444']);

    $('#rows').innerHTML = list.map(function (a) {
      var submitted = a.status === 'Submitted', overdue = asgIsOverdue(a), info = dueInfo(a.deadline, submitted), stu = studentById(a.studentId);
      return '<tr class="' + (overdue ? 'row-overdue' : '') + '" data-id="' + esc(a.id) + '"><td><b>' + esc(a.title) + '</b></td><td><div class="cell-user">' + avatarHtml(stu || { name: '?' }, 'sm') + '<span>' + esc(stu ? stu.name : 'Deleted student') + '</span></div></td><td>' + esc(a.subject) + '</td>' +
        '<td class="nowrap"><div>' + esc(fmtDate(a.deadline)) + '</div><small class="' + (info.cls === 'warn' ? 'warn-text' : 'muted') + '">' + esc(info.text) + '</small></td>' +
        '<td><div class="rate-cell"><div class="progress thin ' + (submitted ? 'green' : overdue ? 'red' : '') + '"><div style="width:' + a.progress + '%"></div></div><b>' + a.progress + '%</b></div></td><td>' + statusBadge(asgDisplayStatus(a)) + '</td>' +
        '<td><button class="icon-btn sm" type="button" data-act="view" title="View details" aria-label="View details"><i class="fa-solid fa-eye"></i></button></td></tr>';
    }).join('');
    $('.table-wrap').classList.toggle('hidden', !list.length);
    $('#emptyBox').innerHTML = !all.length ? emptyState('fa-file-circle-plus', 'No assignments yet', 'Assignments added by students will show up here.', '')
      : !list.length ? emptyState('fa-magnifying-glass', 'No matching assignments', 'Try changing your search or filters.', '') : '';
  }

  function view(a) {
    var stu = studentById(a.studentId);
    openModal({
      title: 'Assignment details', cancelText: 'Close', hideFooter: true,
      content: '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + statusBadge(asgDisplayStatus(a)) + '</div><h3 style="margin-bottom:6px;word-break:break-word">' + esc(a.title) + '</h3><p class="muted" style="white-space:pre-line;margin-bottom:16px">' + esc(a.description || 'No description provided.') + '</p>' +
        '<div class="progress ' + (a.status === 'Submitted' ? 'green' : '') + '" style="margin-bottom:6px"><div style="width:' + a.progress + '%"></div></div><div class="small muted" style="margin-bottom:16px">' + a.progress + '% complete</div>' +
        '<dl class="detail-grid"><div><dt>Student</dt><dd>' + esc(stu ? stu.name + ' (' + stu.rollNo + ')' : 'Deleted student') + '</dd></div><div><dt>Subject</dt><dd>' + esc(a.subject) + '</dd></div><div><dt>Assigned</dt><dd>' + esc(fmtDate(a.assignedDate)) + '</dd></div><div><dt>Deadline</dt><dd class="' + (asgIsOverdue(a) ? 'warn-text' : '') + '">' + esc(fmtDate(a.deadline)) + '</dd></div><div><dt>Submitted on</dt><dd>' + (a.status === 'Submitted' ? esc(fmtDate(a.submittedAt || a.updatedAt)) : '—') + '</dd></div><div><dt>Department</dt><dd>' + esc(stu ? stu.department : '—') + '</dd></div></dl>'
    });
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  [['#fStudent', 'student'], ['#fSubject', 'subject'], ['#fStatus', 'status']].forEach(function (p) {
    $(p[0]).addEventListener('change', function (e) { state[p[1]] = e.target.value; render(); });
  });
  $('#clearBtn').addEventListener('click', function () {
    state = { q: '', student: '', subject: '', status: '' };
    $('#q').value = ''; ['#fStudent', '#fSubject', '#fStatus'].forEach(function (s) { $(s).value = ''; });
    render();
  });
  $('#rows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="view"]');
    if (!b) return;
    var a = getData('assignments', []).find(function (x) { return x.id === b.closest('tr').dataset.id; });
    if (a) view(a);
  });
  render();
  onDataChange(render);
})();

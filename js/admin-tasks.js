/* ==========================================================================
   admin-tasks.js — monitor every student's tasks (read-only by design)
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;
  var state = { q: '', student: '', subject: '', priority: '', status: '' };

  function fillSelects(tasks) {
    var st = $('#fStudent'), sj = $('#fSubject'), curS = st.value, curJ = sj.value;
    var students = getData('students', []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    st.innerHTML = '<option value="">All students</option>' + students.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
    var subs = {}; tasks.forEach(function (t) { if (t.subject) subs[t.subject] = 1; });
    sj.innerHTML = '<option value="">All subjects</option>' + Object.keys(subs).sort().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
    st.value = students.some(function (s) { return s.id === curS; }) ? curS : '';
    sj.value = subs[curJ] ? curJ : '';
    state.student = st.value; state.subject = sj.value;
  }

  function render() {
    var all = getData('tasks', []);
    fillSelects(all);
    var q = state.q.toLowerCase();
    var list = all.filter(function (t) {
      if (q && (t.title + ' ' + t.subject + ' ' + studentName(t.studentId) + ' ' + (t.description || '')).toLowerCase().indexOf(q) === -1) return false;
      if (state.student && t.studentId !== state.student) return false;
      if (state.subject && t.subject !== state.subject) return false;
      if (state.priority && t.priority !== state.priority) return false;
      if (state.status === 'Open') return t.status !== 'Completed';
      if (state.status === 'Overdue') return taskIsOverdue(t);
      if (state.status && t.status !== state.status) return false;
      return true;
    }).sort(function (a, b) { return (a.dueDate || '').localeCompare(b.dueDate || ''); });

    var s = taskStats(list);
    $('#stats').innerHTML = [
      ['fa-list-check', 'ic-purple', list.length, state.student || state.subject || state.priority || state.status || state.q ? 'Matching tasks' : 'Total tasks'],
      ['fa-circle-check', 'ic-green', s.completed, 'Completed'],
      ['fa-hourglass-half', 'ic-blue', s.open, 'Pending / in progress'],
      ['fa-triangle-exclamation', 'ic-red', s.overdue, 'Overdue'],
      ['fa-percent', 'ic-amber', s.rate + '%', 'Completion rate']
    ].map(function (c) { return '<div class="card stat-card"><div class="stat-icon ' + c[1] + '"><i class="fa-solid ' + c[0] + '"></i></div><div><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div>'; }).join('');

    $('#rows').innerHTML = list.map(function (t) {
      var info = dueInfo(t.dueDate, t.status === 'Completed');
      var stu = studentById(t.studentId);
      return '<tr class="' + (taskIsOverdue(t) ? 'row-overdue' : '') + '" data-id="' + esc(t.id) + '"><td><b>' + esc(t.title) + '</b><div class="muted small">' + esc(t.category) + '</div></td><td><div class="cell-user">' + avatarHtml(stu || { name: '?' }, 'sm') + '<span>' + esc(stu ? stu.name : 'Deleted student') + '</span></div></td><td>' + esc(t.subject) + '</td><td>' + priorityBadge(t.priority) + '</td>' +
        '<td class="nowrap"><div>' + esc(fmtDate(t.dueDate)) + '</div><small class="' + (info.cls === 'warn' ? 'warn-text' : 'muted') + '">' + esc(info.text) + '</small></td><td>' + statusBadge(taskDisplayStatus(t)) + '</td>' +
        '<td><button class="icon-btn sm" type="button" data-act="view" title="View details" aria-label="View details"><i class="fa-solid fa-eye"></i></button></td></tr>';
    }).join('');
    $('.table-wrap').classList.toggle('hidden', !list.length);
    $('#emptyBox').innerHTML = !all.length ? emptyState('fa-clipboard-list', 'No tasks created yet', 'Tasks created by students will show up here.', '')
      : !list.length ? emptyState('fa-magnifying-glass', 'No matching tasks', 'Try changing your search or filters.', '') : '';
  }

  function view(t) {
    var stu = studentById(t.studentId);
    openModal({
      title: 'Task details', cancelText: 'Close', hideFooter: true,
      content: '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + priorityBadge(t.priority) + statusBadge(taskDisplayStatus(t)) + '<span class="chip">' + esc(t.category) + '</span></div><h3 style="margin-bottom:6px;word-break:break-word">' + esc(t.title) + '</h3><p class="muted" style="white-space:pre-line;margin-bottom:16px">' + esc(t.description || 'No description provided.') + '</p>' +
        '<dl class="detail-grid"><div><dt>Student</dt><dd>' + esc(stu ? stu.name + ' (' + stu.rollNo + ')' : 'Deleted student') + '</dd></div><div><dt>Department</dt><dd>' + esc(stu ? stu.department : '—') + '</dd></div><div><dt>Subject</dt><dd>' + esc(t.subject) + '</dd></div><div><dt>Estimated time</dt><dd>' + (t.estimatedHours ? esc(t.estimatedHours) + ' hours' : '—') + '</dd></div><div><dt>Start date</dt><dd>' + esc(fmtDate(t.startDate)) + '</dd></div><div><dt>Due date</dt><dd class="' + (taskIsOverdue(t) ? 'warn-text' : '') + '">' + esc(fmtDate(t.dueDate)) + ' (' + esc(dueInfo(t.dueDate, t.status === 'Completed').text) + ')</dd></div><div><dt>Created</dt><dd>' + esc(fmtDate(t.createdAt)) + '</dd></div><div><dt>Completed</dt><dd>' + (t.status === 'Completed' ? esc(fmtDate(t.completedAt || t.updatedAt)) : '—') + '</dd></div></dl>' +
        '<p class="small muted" style="margin-top:16px"><i class="fa-solid fa-lock"></i> Admin view is read-only. Tasks are managed by the student who owns them.</p>'
    });
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  [['#fStudent', 'student'], ['#fSubject', 'subject'], ['#fPriority', 'priority'], ['#fStatus', 'status']].forEach(function (p) {
    $(p[0]).addEventListener('change', function (e) { state[p[1]] = e.target.value; render(); });
  });
  $('#clearBtn').addEventListener('click', function () {
    state = { q: '', student: '', subject: '', priority: '', status: '' };
    $('#q').value = ''; ['#fStudent', '#fSubject', '#fPriority', '#fStatus'].forEach(function (s) { $(s).value = ''; });
    render();
  });
  $('#rows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="view"]');
    if (!b) return;
    var t = getData('tasks', []).find(function (x) { return x.id === b.closest('tr').dataset.id; });
    if (t) view(t);
  });

  var pre = new URLSearchParams(location.search).get('status');
  if (pre && ['Open', 'Pending', 'In Progress', 'Completed', 'Overdue'].indexOf(pre) > -1) { state.status = pre; $('#fStatus').value = pre; }
  render();
  onDataChange(render);
})();

/* ==========================================================================
   reports.js — filtered analytics, charts and CSV export from real stored data
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;
  var f = { from: '', to: '', dept: '', student: '' };

  function localDay(iso) { var d = toDate(iso); return d ? toDateStr(d) : ''; }
  function inRange(iso) {
    var d = localDay(iso);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    return true;
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function legend() { return { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } }; }

  function fillSelects() {
    var d = $('#fDept'), s = $('#fStudent');
    if (!d.options.length) d.innerHTML = '<option value="">All departments</option>' + STP.DEPARTMENTS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
    var pool = getData('students', []).filter(function (x) { return !f.dept || x.department === f.dept; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    s.innerHTML = '<option value="">All students</option>' + pool.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');
    if (!pool.some(function (x) { return x.id === f.student; })) f.student = '';
    s.value = f.student;
    d.value = f.dept;
  }

  function dataset() {
    var students = getData('students', []).filter(function (s) { return (!f.dept || s.department === f.dept) && (!f.student || s.id === f.student); });
    var ids = {}; students.forEach(function (s) { ids[s.id] = 1; });
    var tasks = getData('tasks', []).filter(function (t) { return ids[t.studentId] && inRange(t.createdAt); });
    var asgs = getData('assignments', []).filter(function (a) { return ids[a.studentId] && inRange(a.createdAt); });
    return { students: students, tasks: tasks, asgs: asgs };
  }

  function studentRows(ds) {
    return ds.students.map(function (st) {
      var t = ds.tasks.filter(function (x) { return x.studentId === st.id; }), a = ds.asgs.filter(function (x) { return x.studentId === st.id; });
      return { st: st, ts: taskStats(t), as: asgStats(a) };
    }).sort(function (x, y) { return y.ts.rate - x.ts.rate || y.ts.total - x.ts.total; });
  }
  function deptRows(ds) {
    var names = f.dept ? [f.dept] : STP.DEPARTMENTS;
    return names.map(function (d) {
      var sts = ds.students.filter(function (s) { return s.department === d; }), ids = {};
      sts.forEach(function (s) { ids[s.id] = 1; });
      return { name: d, students: sts.length, ts: taskStats(ds.tasks.filter(function (t) { return ids[t.studentId]; })), as: asgStats(ds.asgs.filter(function (a) { return ids[a.studentId]; })) };
    }).filter(function (r) { return r.students > 0; });
  }

  function render() {
    fillSelects();
    var ds = dataset(), ts = taskStats(ds.tasks), as = asgStats(ds.asgs);
    var srows = studentRows(ds), drows = deptRows(ds);

    $('#stats').innerHTML = [
      ['fa-user-graduate', 'ic-purple', ds.students.length, 'Registered students'],
      ['fa-list-check', 'ic-blue', ts.total, 'Tasks created'],
      ['fa-circle-check', 'ic-green', ts.completed, 'Completed tasks'],
      ['fa-hourglass-half', 'ic-amber', ts.open, 'Pending tasks'],
      ['fa-triangle-exclamation', 'ic-red', ts.overdue, 'Overdue tasks'],
      ['fa-file-circle-check', 'ic-navy', as.rate + '%', 'Assignment completion (' + as.submitted + '/' + as.total + ')']
    ].map(function (c) { return '<div class="card stat-card"><div class="stat-icon ' + c[1] + '"><i class="fa-solid ' + c[0] + '"></i></div><div><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div>'; }).join('');

    // status doughnut
    var overdue = ds.tasks.filter(taskIsOverdue).length;
    doughnutChart('statusChart', ['Completed', 'In progress', 'Pending', 'Overdue'], [
      ts.completed,
      ds.tasks.filter(function (t) { return t.status === 'In Progress' && !taskIsOverdue(t); }).length,
      ds.tasks.filter(function (t) { return t.status === 'Pending' && !taskIsOverdue(t); }).length,
      overdue
    ], ['#10b981', '#f59e0b', '#60a5fa', '#ef4444']);

    // department stacked bars
    renderChart('deptChart', {
      type: 'bar',
      data: { labels: drows.map(function (r) { return r.name; }), datasets: [
        { label: 'Completed', data: drows.map(function (r) { return r.ts.completed; }), backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Open', data: drows.map(function (r) { return r.ts.open - r.ts.overdue; }), backgroundColor: '#60a5fa', borderRadius: 4 },
        { label: 'Overdue', data: drows.map(function (r) { return r.ts.overdue; }), backgroundColor: '#ef4444', borderRadius: 4 }
      ] },
      options: { plugins: { legend: legend() }, scales: { x: { stacked: true, ticks: { callback: function (v) { var l = String(this.getLabelForValue(v)); return l.length > 14 ? l.slice(0, 13) + '…' : l; } } }, y: axisOpts({ stacked: true }) } }
    });

    // student productivity
    var top = srows.filter(function (r) { return r.ts.total > 0; }).slice(0, 12);
    renderChart('studentChart', {
      type: 'bar',
      data: { labels: top.map(function (r) { return r.st.name; }), datasets: [{ label: 'Task completion %', data: top.map(function (r) { return r.ts.rate; }), backgroundColor: top.map(function (r) { return r.ts.rate >= 70 ? '#10b981' : r.ts.rate >= 40 ? '#f59e0b' : '#ef4444'; }), borderRadius: 6, maxBarThickness: 28 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: axisOpts({ max: 100, ticks: { callback: function (v) { return v + '%'; } } }) } }
    });

    // tasks created over time (weekly buckets)
    var buckets = {};
    ds.tasks.forEach(function (t) { var k = startOfWeek(localDay(t.createdAt)); buckets[k] = (buckets[k] || 0) + 1; });
    var keys = Object.keys(buckets).sort(), full = [];
    if (keys.length) { for (var k = keys[0]; k <= keys[keys.length - 1]; k = addDays(k, 7)) full.push(k); }
    renderChart('timeChart', {
      type: 'line',
      data: { labels: full.map(function (k) { var d = parseDate(k); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }), datasets: [{ label: 'Tasks created (week starting)', data: full.map(function (k) { return buckets[k] || 0; }), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.14)', fill: true, tension: .35, pointRadius: 4 }] },
      options: { plugins: { legend: legend() }, scales: { y: axisOpts() } }
    });

    // tables
    function rate(v, cls) { return '<div class="rate-cell"><div class="progress thin ' + (cls || '') + '"><div style="width:' + v + '%"></div></div><b>' + v + '%</b></div>'; }
    $('#deptRows').innerHTML = drows.length ? drows.map(function (r) {
      return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + r.students + '</td><td>' + r.ts.total + '</td><td>' + r.ts.completed + '</td><td class="' + (r.ts.overdue ? 'warn-text' : '') + '">' + r.ts.overdue + '</td><td>' + rate(r.ts.rate) + '</td><td>' + rate(r.as.rate, 'green') + '</td></tr>';
    }).join('') : '<tr><td colspan="7">' + emptyState('fa-chart-simple', 'No data for these filters', 'Adjust the filters to see department statistics.', '', true) + '</td></tr>';
    $('#studentRows').innerHTML = srows.length ? srows.map(function (r) {
      return '<tr><td><div class="cell-user">' + avatarHtml(r.st, 'sm') + '<div><b>' + esc(r.st.name) + '</b><small class="muted">' + esc(r.st.rollNo) + '</small></div></div></td><td>' + esc(r.st.department) + '</td><td>' + r.ts.total + '</td><td>' + r.ts.completed + '</td><td class="' + (r.ts.overdue ? 'warn-text' : '') + '">' + r.ts.overdue + '</td><td>' + rate(r.ts.rate) + '</td><td>' + r.as.submitted + '/' + r.as.total + '</td></tr>';
    }).join('') : '<tr><td colspan="7">' + emptyState('fa-user-graduate', 'No students match', 'Adjust the filters to see student productivity.', '', true) + '</td></tr>';
  }

  /* ---------- CSV exports ---------- */
  function stamp() { return todayStr(); }
  function exportStudents() {
    var rows = studentRows(dataset());
    if (!rows.length) return toast('There is no data to export for the current filters.', 'warning');
    downloadCSV('student-productivity-' + stamp() + '.csv',
      ['Student ID', 'Name', 'Email', 'Department', 'Semester', 'Tasks', 'Completed', 'Pending', 'Overdue', 'Task completion %', 'Assignments', 'Submitted', 'Assignment completion %'],
      rows.map(function (r) { return [r.st.rollNo, r.st.name, r.st.email, r.st.department, r.st.semester, r.ts.total, r.ts.completed, r.ts.open, r.ts.overdue, r.ts.rate, r.as.total, r.as.submitted, r.as.rate]; }));
    toast('Student report exported (' + plural(rows.length, 'row') + ').', 'success');
  }
  function exportDepts() {
    var rows = deptRows(dataset());
    if (!rows.length) return toast('There is no data to export for the current filters.', 'warning');
    downloadCSV('department-statistics-' + stamp() + '.csv',
      ['Department', 'Students', 'Tasks', 'Completed', 'Pending', 'Overdue', 'Task completion %', 'Assignments', 'Submitted', 'Assignment completion %'],
      rows.map(function (r) { return [r.name, r.students, r.ts.total, r.ts.completed, r.ts.open, r.ts.overdue, r.ts.rate, r.as.total, r.as.submitted, r.as.rate]; }));
    toast('Department report exported.', 'success');
  }
  function exportTasks() {
    var ds = dataset();
    if (!ds.tasks.length) return toast('There are no tasks to export for the current filters.', 'warning');
    downloadCSV('tasks-' + stamp() + '.csv',
      ['Student ID', 'Student', 'Department', 'Title', 'Subject', 'Category', 'Priority', 'Status', 'Start date', 'Due date', 'Created', 'Completed'],
      ds.tasks.map(function (t) {
        var s = studentById(t.studentId) || {};
        return [s.rollNo || '', s.name || 'Deleted student', s.department || '', t.title, t.subject, t.category, t.priority, taskDisplayStatus(t), t.startDate, t.dueDate, localDay(t.createdAt), t.completedAt ? localDay(t.completedAt) : ''];
      }));
    toast('Task data exported (' + plural(ds.tasks.length, 'row') + ').', 'success');
  }

  $('#fFrom').addEventListener('change', function (e) { f.from = e.target.value; if (f.to && f.from && f.from > f.to) { toast('"From" date is after the "To" date.', 'warning'); } render(); });
  $('#fTo').addEventListener('change', function (e) { f.to = e.target.value; if (f.to && f.from && f.from > f.to) { toast('"To" date is before the "From" date.', 'warning'); } render(); });
  $('#fDept').addEventListener('change', function (e) { f.dept = e.target.value; render(); });
  $('#fStudent').addEventListener('change', function (e) { f.student = e.target.value; render(); });
  $('#resetFilters').addEventListener('click', function () {
    f = { from: '', to: '', dept: '', student: '' };
    $('#fFrom').value = ''; $('#fTo').value = '';
    render();
  });
  $('#expStudents').addEventListener('click', exportStudents);
  $('#expDept').addEventListener('click', exportDepts);
  $('#expTasks').addEventListener('click', exportTasks);

  render();
  onDataChange(render);
})();

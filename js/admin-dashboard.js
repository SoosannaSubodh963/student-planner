/* ==========================================================================
   admin-dashboard.js — system-wide statistics, charts and lists
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;

  var MON = MONTHS;

  function localDay(iso) { var d = toDate(iso); return d ? toDateStr(d) : ''; }
  function statCard(href, icon, cls, value, label) {
    return '<a class="card hover stat-card" href="' + href + '"><div class="stat-icon ' + cls + '"><i class="fa-solid ' + icon + '"></i></div><div><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div></a>';
  }
  function legendOpts() { return { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } }; }

  function render() {
    var me = getCurrentUser();
    if (!me) return;
    var students = getData('students', []), tasks = getData('tasks', []), asgs = getData('assignments', []);
    var s = taskStats(tasks), a = asgStats(asgs);

    $('#greet').textContent = greeting() + ', ' + String(me.name).split(' ')[0] + '!';
    $('#greetSub').textContent = fmtDateLong() + ' · ' + students.length + ' students registered, ' + s.overdue + ' overdue tasks to watch';

    $('#stats').innerHTML =
      statCard('students.html', 'fa-user-graduate', 'ic-purple', students.length, 'Registered Students') +
      statCard('tasks.html', 'fa-list-check', 'ic-blue', s.total, 'Total Tasks') +
      statCard('tasks.html?status=Completed', 'fa-circle-check', 'ic-green', s.completed, 'Completed Tasks') +
      statCard('tasks.html?status=Open', 'fa-hourglass-half', 'ic-amber', s.open, 'Pending Tasks') +
      statCard('tasks.html?status=Overdue', 'fa-triangle-exclamation', 'ic-red', s.overdue, 'Overdue Tasks') +
      statCard('assignments.html', 'fa-file-lines', 'ic-navy', a.total, 'Total Assignments');

    // 1. registrations, last 6 months
    var now = new Date(), labels = [], newCounts = [], cumulative = [];
    for (var i = 5; i >= 0; i--) {
      var m = new Date(now.getFullYear(), now.getMonth() - i, 1), next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      labels.push(MON[m.getMonth()] + ' ' + String(m.getFullYear()).slice(2));
      newCounts.push(students.filter(function (x) { var d = toDate(x.createdAt); return d && d >= m && d < next; }).length);
      cumulative.push(students.filter(function (x) { var d = toDate(x.createdAt); return d && d < next; }).length);
    }
    renderChart('regChart', {
      type: 'bar',
      data: { labels: labels, datasets: [
        { type: 'bar', label: 'New students', data: newCounts, backgroundColor: '#8b5cf6', borderRadius: 7, maxBarThickness: 34 },
        { type: 'line', label: 'Total students', data: cumulative, borderColor: '#60a5fa', backgroundColor: '#60a5fa', tension: .35, pointRadius: 4 }
      ] },
      options: { plugins: { legend: legendOpts() }, scales: { y: axisOpts() } }
    });

    // 2. task completion
    var overdueOnly = tasks.filter(taskIsOverdue).length;
    var inProg = tasks.filter(function (t) { return t.status === 'In Progress' && !taskIsOverdue(t); }).length;
    var pend = tasks.filter(function (t) { return t.status === 'Pending' && !taskIsOverdue(t); }).length;
    doughnutChart('taskChart', ['Completed', 'In progress', 'Pending', 'Overdue'], [s.completed, inProg, pend, overdueOnly], ['#10b981', '#f59e0b', '#60a5fa', '#ef4444']);

    // 3. departments
    var depts = STP.DEPARTMENTS.map(function (d) { return [d, students.filter(function (x) { return x.department === d; }).length]; }).filter(function (d) { return d[1] > 0; });
    doughnutChart('deptChart', depts.map(function (d) { return d[0]; }), depts.map(function (d) { return d[1]; }), CHART_COLORS, '58%');

    // 4. assignments
    var aOver = asgs.filter(asgIsOverdue).length;
    doughnutChart('asgChart', ['Submitted', 'In progress', 'Not started', 'Overdue'], [
      a.submitted,
      asgs.filter(function (x) { return x.status === 'In Progress' && !asgIsOverdue(x); }).length,
      asgs.filter(function (x) { return x.status === 'Not Started' && !asgIsOverdue(x); }).length,
      aOver
    ], ['#10b981', '#f59e0b', '#60a5fa', '#ef4444']);

    // 5. overall productivity (8 weeks)
    var ws = startOfWeek(todayStr()), wl = [], created = [], completed = [];
    for (var w = 7; w >= 0; w--) {
      var from = addDays(ws, -7 * w), to = addDays(from, 6);
      var d0 = parseDate(from);
      wl.push(d0.getDate() + ' ' + MON[d0.getMonth()]);
      created.push(tasks.filter(function (t) { var d = localDay(t.createdAt); return d >= from && d <= to; }).length);
      completed.push(tasks.filter(function (t) { var d = localDay(t.completedAt); return t.status === 'Completed' && d && d >= from && d <= to; }).length);
    }
    renderChart('prodChart', {
      type: 'line',
      data: { labels: wl, datasets: [
        { label: 'Tasks created', data: created, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.16)', fill: true, tension: .35, pointRadius: 4 },
        { label: 'Tasks completed', data: completed, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.14)', fill: true, tension: .35, pointRadius: 4 }
      ] },
      options: { plugins: { legend: legendOpts() }, scales: { y: axisOpts() } }
    });

    // lists
    var recentS = students.slice().sort(function (x, y) { return y.createdAt.localeCompare(x.createdAt); }).slice(0, 5);
    $('#recentStudents').innerHTML = recentS.length ? recentS.map(function (st) {
      return '<div class="pending-row">' + avatarHtml(st, 'sm') + '<div class="pr-main"><b class="truncate">' + esc(st.name) + '</b><small>' + esc(st.department) + ' · Sem ' + esc(st.semester) + '</small></div><span class="muted small nowrap">' + esc(fmtDate(st.createdAt)) + '</span></div>';
    }).join('') : emptyState('fa-user-plus', 'No students yet', 'Registered students will appear here.', '', true);

    var recentT = tasks.slice().sort(function (x, y) { return y.createdAt.localeCompare(x.createdAt); }).slice(0, 5);
    $('#recentTasks').innerHTML = recentT.length ? recentT.map(function (t) {
      return '<div class="pending-row"><div class="pr-main"><b class="truncate">' + esc(t.title) + '</b><small>' + esc(studentName(t.studentId)) + ' · ' + esc(timeAgo(t.createdAt)) + '</small></div>' + priorityBadge(t.priority) + '</div>';
    }).join('') : emptyState('fa-list-check', 'No tasks yet', 'Tasks created by students will appear here.', '', true);

    var pend2 = students.map(function (st) {
      var mine = tasks.filter(function (t) { return t.studentId === st.id && t.status !== 'Completed'; });
      return { st: st, open: mine.length, overdue: mine.filter(taskIsOverdue).length };
    }).filter(function (r) { return r.open > 0; }).sort(function (x, y) { return y.open - x.open || y.overdue - x.overdue; }).slice(0, 6);
    $('#pendingStudents').innerHTML = pend2.length ? pend2.map(function (r) {
      return '<div class="pending-row">' + avatarHtml(r.st, 'sm') + '<div class="pr-main"><b class="truncate">' + esc(r.st.name) + '</b><small>' + (r.overdue ? '<span class="warn-text">' + r.overdue + ' overdue</span>' : 'No overdue tasks') + '</small></div><span class="pending-count" title="Open tasks">' + r.open + '</span></div>';
    }).join('') : emptyState('fa-champagne-glasses', 'All caught up', 'No student has pending tasks.', '', true);
  }

  render();
  onDataChange(render);
})();

/* ==========================================================================
   student-dashboard.js — personalised dashboard (all numbers come from LocalStorage)
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;

  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function weekDates() {
    var start = startOfWeek(todayStr()), out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(start, i));
    return out;
  }
  function hoursOf(s) {
    var a = (s.startTime || '0:0').split(':').map(Number), b = (s.endTime || '0:0').split(':').map(Number);
    return Math.max(0, ((b[0] * 60 + b[1]) - (a[0] * 60 + a[1])) / 60);
  }
  function localDay(iso) { var d = toDate(iso); return d ? toDateStr(d) : ''; }

  function statCard(href, icon, cls, value, label) {
    return '<a class="card hover stat-card" href="' + href + '"><div class="stat-icon ' + cls + '"><i class="fa-solid ' + icon + '"></i></div><div><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div></a>';
  }

  function render() {
    var me = getCurrentUser();
    if (!me) return;
    var tasks = ownRecords('tasks', me.id), asgs = ownRecords('assignments', me.id), sessions = ownRecords('studySessions', me.id);
    var s = taskStats(tasks), week = weekDates(), today = todayStr();

    $('#greet').textContent = greeting() + ', ' + String(me.name).split(' ')[0] + '!';
    $('#greetSub').textContent = fmtDateLong() + ' · ' + (s.total ? s.rate + '% of your tasks are complete' : 'Add your first task to get started');

    $('#stats').innerHTML =
      statCard('tasks.html', 'fa-list-check', 'ic-purple', s.total, 'Total Tasks') +
      statCard('tasks.html?status=Open', 'fa-hourglass-half', 'ic-blue', s.open, 'Pending Tasks') +
      statCard('tasks.html?status=Completed', 'fa-circle-check', 'ic-green', s.completed, 'Completed Tasks') +
      statCard('tasks.html?status=Overdue', 'fa-triangle-exclamation', 'ic-red', s.overdue, 'Overdue Tasks') +
      statCard('calendar.html', 'fa-calendar-check', 'ic-amber', s.upcoming, 'Upcoming Deadlines');

    // weekly overview
    $('#weekRange').textContent = fmtDate(week[0]) + ' – ' + fmtDate(week[6]);
    $('#weekStrip').innerHTML = week.map(function (d, i) {
      var due = tasks.filter(function (t) { return t.dueDate === d; });
      var dots = due.slice(0, 4).map(function (t) { return '<i class="' + (t.status === 'Completed' ? 'done' : '') + '"></i>'; }).join('');
      return '<div class="week-day' + (d === today ? ' today' : '') + '"><small>' + DAYS[i] + '</small><b>' + parseDate(d).getDate() + '</b><span>' + due.length + ' due</span><div class="wd-dots">' + dots + '</div></div>';
    }).join('');

    // completion ring
    var ring = $('#ring');
    ring.style.setProperty('--p', s.rate);
    $('#ringText').textContent = s.rate + '%';
    var legend = [['Completed', s.completed, '#10b981'], ['In progress', s.inProgress, '#f59e0b'], ['Pending', s.pending, '#60a5fa'], ['Overdue', s.overdue, '#ef4444']];
    $('#legend').innerHTML = legend.map(function (l) { return '<div><span><i class="sw" style="background:' + l[2] + '"></i>' + l[0] + '</span><b>' + l[1] + '</b></div>'; }).join('') +
      '<div class="muted small">Overdue items are also counted in their status above.</div>';

    // charts
    var completedPerDay = week.map(function (d) { return tasks.filter(function (t) { return t.status === 'Completed' && localDay(t.completedAt) === d; }).length; });
    var duePerDay = week.map(function (d) { return tasks.filter(function (t) { return t.dueDate === d; }).length; });
    renderChart('weeklyChart', {
      type: 'bar',
      data: { labels: DAYS, datasets: [
        { label: 'Completed', data: completedPerDay, backgroundColor: '#8b5cf6', borderRadius: 7, maxBarThickness: 26 },
        { label: 'Due', data: duePerDay, backgroundColor: '#93c5fd', borderRadius: 7, maxBarThickness: 26 }
      ] },
      options: { plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: axisOpts() } }
    });
    var byPri = ['High', 'Medium', 'Low'].map(function (p) { return tasks.filter(function (t) { return t.priority === p; }).length; });
    doughnutChart('priorityChart', ['High', 'Medium', 'Low'], byPri, ['#ef4444', '#f59e0b', '#10b981']);
    var planned = week.map(function (d) { return +sessions.filter(function (x) { return x.date === d && x.status !== 'Skipped'; }).reduce(function (a, x) { return a + hoursOf(x); }, 0).toFixed(2); });
    var done = week.map(function (d) { return +sessions.filter(function (x) { return x.date === d && x.status === 'Completed'; }).reduce(function (a, x) { return a + hoursOf(x); }, 0).toFixed(2); });
    renderChart('studyChart', {
      type: 'line',
      data: { labels: DAYS, datasets: [
        { label: 'Planned (h)', data: planned, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.18)', fill: true, tension: .35, pointRadius: 4 },
        { label: 'Completed (h)', data: done, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)', fill: true, tension: .35, pointRadius: 4 }
      ] },
      options: { plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: axisOpts({ ticks: { precision: 1 } }) } }
    });

    // upcoming deadlines (tasks + assignments)
    var items = [];
    tasks.forEach(function (t) { if (t.status !== 'Completed' && t.dueDate && t.dueDate >= today) items.push({ kind: 'task', id: t.id, title: t.title, sub: t.subject, date: t.dueDate, pri: t.priority }); });
    asgs.forEach(function (a) { if (a.status !== 'Submitted' && a.deadline && a.deadline >= today) items.push({ kind: 'asg', id: a.id, title: a.title, sub: a.subject, date: a.deadline, pri: 'Medium' }); });
    items.sort(function (a, b) { return a.date.localeCompare(b.date); });
    $('#upcoming').innerHTML = items.length ? items.slice(0, 6).map(function (it) {
      var info = dueInfo(it.date, false);
      var cls = it.kind === 'asg' ? 'ic-purple' : it.pri === 'High' ? 'ic-red' : it.pri === 'Medium' ? 'ic-amber' : 'ic-green';
      var href = it.kind === 'asg' ? 'assignments.html' : 'tasks.html?view=' + encodeURIComponent(it.id);
      return '<a class="list-item" href="' + href + '"><div class="li-ic ' + cls + '"><i class="fa-solid ' + (it.kind === 'asg' ? 'fa-file-pen' : 'fa-list-check') + '"></i></div><div class="li-main"><b>' + esc(it.title) + '</b><span>' + esc(it.sub) + ' · ' + (it.kind === 'asg' ? 'Assignment' : 'Task') + '</span></div><span class="badge ' + (info.cls === 'soon' ? 'b-medium' : 'b-pending') + '">' + esc(info.text) + '</span></a>';
    }).join('') : emptyState('fa-champagne-glasses', 'Nothing due soon', 'You have no upcoming deadlines. Enjoy the breathing room!', '', true);

    // recent activities
    var logs = getData('activityLogs', []).filter(function (l) { return l.userId === me.id && l.action !== 'Logged in'; })
      .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 6);
    $('#recent').innerHTML = logs.length ? logs.map(function (l) {
      var icon = /Complet|Submit/.test(l.action) ? 'fa-circle-check' : /Delet/.test(l.action) ? 'fa-trash' : /Add|Regist/.test(l.action) ? 'fa-plus' : 'fa-pen';
      var cls = /Complet|Submit/.test(l.action) ? 'ic-green' : /Delet/.test(l.action) ? 'ic-red' : 'ic-purple';
      return '<div class="list-item"><div class="li-ic ' + cls + '"><i class="fa-solid ' + icon + '"></i></div><div class="li-main"><b>' + esc(l.action) + '</b><span>' + esc(l.detail || '—') + '</span></div><span class="muted small nowrap">' + timeAgo(l.createdAt) + '</span></div>';
    }).join('') : emptyState('fa-clock-rotate-left', 'No activity yet', 'Your recent actions will appear here.', '', true);
  }

  $('#addTaskBtn').addEventListener('click', function () { openTaskModal(null, { onSaved: render }); });
  render();
  onDataChange(render);
})();

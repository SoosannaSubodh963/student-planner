/* ==========================================================================
   calendar.js — monthly calendar built from the student's stored deadlines
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;

  var today = todayStr();
  var now = new Date();
  var view = { year: now.getFullYear(), month: now.getMonth() };
  var selected = today;
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function tasks() { return ownRecords('tasks', user.id); }
  function asgs() { return ownRecords('assignments', user.id); }

  function itemsOn(date) {
    var out = [];
    tasks().forEach(function (t) { if (t.dueDate === date) out.push({ kind: 'task', rec: t, label: t.title, cls: String(t.priority).toLowerCase() + (t.status === 'Completed' ? ' done' : '') }); });
    asgs().forEach(function (a) { if (a.deadline === date) out.push({ kind: 'asg', rec: a, label: a.title, cls: 'asg' + (a.status === 'Submitted' ? ' done' : '') }); });
    return out;
  }

  function renderGrid() {
    $('#monthTitle').textContent = MONTH_NAMES[view.month] + ' ' + view.year;
    var first = new Date(view.year, view.month, 1);
    var offset = (first.getDay() + 6) % 7; // Monday first
    var start = new Date(view.year, view.month, 1 - offset);
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var ds = toDateStr(d), items = itemsOn(ds);
      var cls = 'cal-cell' + (d.getMonth() !== view.month ? ' other' : '') + (ds === today ? ' today' : '') + (ds === selected ? ' selected' : '');
      var chips = items.slice(0, 2).map(function (it) { return '<span class="cal-chip ' + it.cls + '" title="' + esc(it.label) + '">' + esc(it.label) + '</span>'; }).join('');
      var more = items.length > 2 ? '<span class="cal-more">+' + (items.length - 2) + ' more</span>' : '';
      var dots = items.slice(0, 4).map(function () { return '<i></i>'; }).join('');
      cells.push('<button type="button" class="' + cls + '" data-date="' + ds + '" aria-label="' + esc(fmtDateLong(d)) + ', ' + items.length + ' items"><span class="dn">' + d.getDate() + '</span>' + chips + more + '<span class="cal-dots">' + dots + '</span></button>');
      if (i === 34 && new Date(start.getFullYear(), start.getMonth(), start.getDate() + 35).getMonth() !== view.month) break; // skip empty 6th row
    }
    $('#calGrid').innerHTML = cells.join('');
  }

  function renderDay() {
    var d = parseDate(selected), items = itemsOn(selected);
    $('#dayTitle').textContent = selected === today ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'long' });
    $('#daySub').textContent = fmtDateLong(d);
    var sessions = ownRecords('studySessions', user.id).filter(function (s) { return s.date === selected; });
    var html = items.map(function (it) {
      if (it.kind === 'task') {
        var t = it.rec, done = t.status === 'Completed';
        return '<div class="list-item" data-kind="task" data-id="' + esc(t.id) + '"><button class="check-btn' + (done ? ' on' : '') + '" type="button" data-act="toggle" aria-label="Toggle complete"><i class="fa-solid fa-check"></i></button><div class="li-main"><b style="' + (done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(t.title) + '</b><span>' + esc(t.subject) + ' · ' + priorityBadge(t.priority).replace(/<[^>]+>/g, '') + ' priority</span></div>' + statusBadge(taskDisplayStatus(t)) + '<button class="icon-btn sm" type="button" data-act="edit" aria-label="Edit task"><i class="fa-solid fa-pen"></i></button></div>';
      }
      var a = it.rec;
      return '<a class="list-item" href="assignments.html"><div class="li-ic ic-purple"><i class="fa-solid fa-file-pen"></i></div><div class="li-main"><b>' + esc(a.title) + '</b><span>Assignment deadline · ' + esc(a.subject) + '</span></div>' + statusBadge(asgDisplayStatus(a)) + '</a>';
    }).join('');
    html += sessions.map(function (s) {
      return '<a class="list-item" href="study-planner.html"><div class="li-ic ic-blue"><i class="fa-solid fa-book-open-reader"></i></div><div class="li-main"><b>Study: ' + esc(s.subject) + '</b><span>' + fmtTime(s.startTime) + ' – ' + fmtTime(s.endTime) + '</span></div>' + statusBadge(s.status) + '</a>';
    }).join('');
    $('#dayList').innerHTML = html || emptyState('fa-mug-hot', 'Nothing scheduled', 'No deadlines or study sessions on this date.', '', true);
  }

  function renderUpcoming() {
    var list = [];
    tasks().forEach(function (t) { if (t.status !== 'Completed' && t.dueDate >= today) list.push({ k: 'task', id: t.id, title: t.title, sub: t.subject, date: t.dueDate }); });
    asgs().forEach(function (a) { if (a.status !== 'Submitted' && a.deadline >= today) list.push({ k: 'asg', id: a.id, title: a.title, sub: a.subject, date: a.deadline }); });
    list.sort(function (a, b) { return a.date.localeCompare(b.date); });
    $('#upcoming').innerHTML = list.length ? list.slice(0, 6).map(function (it) {
      var info = dueInfo(it.date, false);
      return '<a class="list-item" href="' + (it.k === 'asg' ? 'assignments.html' : 'tasks.html?view=' + encodeURIComponent(it.id)) + '"><div class="li-ic ' + (it.k === 'asg' ? 'ic-purple' : 'ic-amber') + '"><i class="fa-solid ' + (it.k === 'asg' ? 'fa-file-pen' : 'fa-flag') + '"></i></div><div class="li-main"><b>' + esc(it.title) + '</b><span>' + fmtDate(it.date) + ' · ' + esc(info.text) + '</span></div></a>';
    }).join('') : emptyState('fa-champagne-glasses', 'All clear', 'No upcoming deadlines.', '', true);
  }

  function renderAll() { renderGrid(); renderDay(); renderUpcoming(); }

  function shift(n) {
    var d = new Date(view.year, view.month + n, 1);
    view.year = d.getFullYear(); view.month = d.getMonth();
    renderGrid();
  }
  function addOn(date) {
    var def = { dueDate: date };
    if (date < today) def.startDate = date;
    openTaskModal(null, { defaults: def, onSaved: renderAll });
  }

  $('#prevBtn').addEventListener('click', function () { shift(-1); });
  $('#nextBtn').addEventListener('click', function () { shift(1); });
  $('#todayBtn').addEventListener('click', function () {
    var n = new Date(); view.year = n.getFullYear(); view.month = n.getMonth(); selected = todayStr(); renderAll();
  });
  $('#addBtn').addEventListener('click', function () { addOn(selected); });
  $('#addDayBtn').addEventListener('click', function () { addOn(selected); });
  $('#calGrid').addEventListener('click', function (e) {
    var c = e.target.closest('.cal-cell');
    if (!c) return;
    selected = c.dataset.date;
    var d = parseDate(selected);
    if (d.getMonth() !== view.month) { view.year = d.getFullYear(); view.month = d.getMonth(); }
    renderAll();
  });
  $('#calGrid').addEventListener('dblclick', function (e) {
    var c = e.target.closest('.cal-cell');
    if (c) addOn(c.dataset.date);
  });
  $('#dayList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = btn.closest('[data-id]');
    var t = tasks().find(function (x) { return x.id === row.dataset.id; });
    if (!t) return;
    if (btn.dataset.act === 'edit') openTaskModal(t, { onSaved: renderAll });
    else {
      var done = t.status === 'Completed', nowIso = new Date().toISOString();
      updateData('tasks', t.id, { status: done ? 'Pending' : 'Completed', updatedAt: nowIso, completedAt: done ? '' : nowIso });
      logActivity(user.id, 'student', done ? 'Updated task' : 'Completed task', t.title);
      toast(done ? 'Task reopened.' : 'Task marked as completed.', 'success');
    }
  });

  renderAll();
  onDataChange(renderAll);
})();

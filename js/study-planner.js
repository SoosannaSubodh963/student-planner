/* ==========================================================================
   study-planner.js — study sessions: CRUD, today's schedule, upcoming, weekly grid
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;

  var STATUSES = ['Planned', 'In Progress', 'Completed', 'Skipped'];
  var weekOffset = 0;
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function mine() { return ownRecords('studySessions', user.id); }
  function byTime(a, b) { return (a.date + a.startTime).localeCompare(b.date + b.startTime); }
  function mins(t) { var p = (t || '0:0').split(':').map(Number); return p[0] * 60 + p[1]; }
  function hours(s) { return Math.max(0, (mins(s.endTime) - mins(s.startTime)) / 60); }
  function fmtHours(h) { return (Math.round(h * 10) / 10) + ' h'; }

  function openSessionModal(session, defaults) {
    var s = session || {}, d = defaults || {}, isEdit = !!session;
    var v = function (k, def) { return s[k] !== undefined ? s[k] : (d[k] !== undefined ? d[k] : def); };
    var content = '<datalist id="subjectList">' + subjectOptions(user.id).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><div class="form-grid">' +
      fld({ label: 'Subject', name: 'subject', required: true, value: v('subject', ''), attrs: 'list="subjectList" autocomplete="off" maxlength="60"', placeholder: 'Choose or type a subject' }) +
      fld({ label: 'Study date', name: 'date', type: 'date', required: true, value: v('date', todayStr()) }) +
      fld({ label: 'Start time', name: 'startTime', type: 'time', required: true, value: v('startTime', '18:00') }) +
      fld({ label: 'End time', name: 'endTime', type: 'time', required: true, value: v('endTime', '19:00') }) +
      fld({ label: 'Status', name: 'status', type: 'select', options: STATUSES, value: v('status', 'Planned'), full: true }) +
      fld({ label: 'Study goals', name: 'goals', type: 'textarea', full: true, value: v('goals', ''), placeholder: 'What do you want to achieve in this session?', attrs: 'maxlength="300"' }) + '</div>';
    openModal({
      title: isEdit ? 'Edit Study Session' : 'Add Study Session', content: content,
      submitText: isEdit ? '<i class="fa-solid fa-check"></i> Save Changes' : '<i class="fa-solid fa-plus"></i> Add Session',
      onSubmit: function (f, api, action, form) {
        var errs = {};
        if (!f.subject) errs.subject = 'Subject is required.';
        if (!f.date) errs.date = 'Choose a study date.';
        if (!f.startTime) errs.startTime = 'Set a start time.';
        if (!f.endTime) errs.endTime = 'Set an end time.';
        if (f.startTime && f.endTime && mins(f.endTime) <= mins(f.startTime)) errs.endTime = 'End time must be after the start time.';
        if (!Object.keys(errs).length && f.status !== 'Skipped') {
          var clash = mine().find(function (x) {
            return x.id !== s.id && x.date === f.date && x.status !== 'Skipped' && mins(f.startTime) < mins(x.endTime) && mins(f.endTime) > mins(x.startTime);
          });
          if (clash) errs.startTime = 'Overlaps with your ' + clash.subject + ' session (' + fmtTime(clash.startTime) + ' – ' + fmtTime(clash.endTime) + ').';
        }
        if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
        var rec = { subject: f.subject, date: f.date, startTime: f.startTime, endTime: f.endTime, goals: f.goals, status: f.status, updatedAt: new Date().toISOString() };
        var saved;
        if (isEdit) { saved = updateData('studySessions', s.id, rec); if (saved) logActivity(user.id, 'student', 'Updated study session', f.subject); }
        else { saved = insertData('studySessions', Object.assign(rec, { studentId: user.id })); if (saved) logActivity(user.id, 'student', 'Added study session', f.subject); }
        if (!saved) return;
        toast(isEdit ? 'Study session updated.' : 'Study session added.', 'success');
        api.close();
      }
    });
  }

  function sessionRow(s, showDate) {
    var done = s.status === 'Completed';
    return '<div class="timeline-item" data-id="' + esc(s.id) + '"><div class="tl-time">' + esc(fmtTime(s.startTime)) + '<small>to ' + esc(fmtTime(s.endTime)) + '</small></div>' +
      '<div class="grow" style="min-width:0"><b style="' + (done ? 'text-decoration:line-through;opacity:.65' : '') + '">' + esc(s.subject) + '</b><div class="muted small">' + (showDate ? '<i class="fa-regular fa-calendar"></i> ' + esc(fmtDate(s.date)) + ' · ' : '') + fmtHours(hours(s)) + (s.goals ? ' · ' + esc(s.goals) : '') + '</div></div>' +
      statusBadge(s.status) +
      '<div class="row-actions"><button class="icon-btn sm success" type="button" data-act="toggle" title="' + (done ? 'Mark as planned' : 'Mark as completed') + '" aria-label="Toggle completed"><i class="fa-solid fa-check"></i></button><button class="icon-btn sm" type="button" data-act="edit" aria-label="Edit session"><i class="fa-solid fa-pen"></i></button><button class="icon-btn sm danger" type="button" data-act="delete" aria-label="Delete session"><i class="fa-solid fa-trash"></i></button></div></div>';
  }

  function render() {
    var all = mine(), today = todayStr();
    var weekStart = addDays(startOfWeek(today), weekOffset * 7), week = [];
    for (var i = 0; i < 7; i++) week.push(addDays(weekStart, i));

    var todays = all.filter(function (s) { return s.date === today; }).sort(byTime);
    var upcoming = all.filter(function (s) { return s.date > today && s.status !== 'Skipped' && s.status !== 'Completed'; }).sort(byTime);
    var thisWeek = all.filter(function (s) { return s.date >= startOfWeek(today) && s.date <= addDays(startOfWeek(today), 6) && s.status !== 'Skipped'; });
    var plannedH = thisWeek.reduce(function (a, s) { return a + hours(s); }, 0);
    var doneH = thisWeek.filter(function (s) { return s.status === 'Completed'; }).reduce(function (a, s) { return a + hours(s); }, 0);

    $('#stats').innerHTML = [
      ['fa-sun', 'ic-amber', todays.length, "Today's sessions"],
      ['fa-forward', 'ic-blue', upcoming.length, 'Upcoming sessions'],
      ['fa-hourglass-half', 'ic-purple', fmtHours(plannedH), 'Planned this week'],
      ['fa-circle-check', 'ic-green', fmtHours(doneH), 'Studied this week']
    ].map(function (c) { return '<div class="card stat-card"><div class="stat-icon ' + c[1] + '"><i class="fa-solid ' + c[0] + '"></i></div><div><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div>'; }).join('');

    $('#todayList').innerHTML = todays.length ? todays.map(function (s) { return sessionRow(s, false); }).join('')
      : emptyState('fa-mug-hot', 'No sessions today', 'Plan a focused study session for today.', '<button class="btn btn-primary btn-sm" type="button" data-act="add"><i class="fa-solid fa-plus"></i> Plan a session</button>', true);
    $('#upcomingList').innerHTML = upcoming.length ? upcoming.slice(0, 6).map(function (s) { return sessionRow(s, true); }).join('')
      : emptyState('fa-calendar-plus', 'Nothing upcoming', 'Schedule future sessions to stay ahead.', '', true);

    $('#weekLabel').textContent = fmtDate(week[0]) + ' – ' + fmtDate(week[6]) + (weekOffset === 0 ? ' (this week)' : '');
    $('#weekGrid').innerHTML = week.map(function (d, idx) {
      var ss = all.filter(function (s) { return s.date === d; }).sort(byTime);
      return '<div class="wk-col' + (d === today ? ' today' : '') + '"><div class="wk-head"><b>' + DAYS[idx] + ' ' + parseDate(d).getDate() + '</b><span>' + fmtHours(ss.filter(function (s) { return s.status !== 'Skipped'; }).reduce(function (a, s) { return a + hours(s); }, 0)) + '</span></div>' +
        ss.map(function (s) {
          return '<div class="sess-chip ' + esc(s.status.toLowerCase().replace(' ', '-')) + '" data-id="' + esc(s.id) + '" data-act="edit" tabindex="0" role="button" title="Edit session"><b>' + esc(s.subject) + '</b><span>' + esc(fmtTime(s.startTime)) + ' – ' + esc(fmtTime(s.endTime)) + '</span></div>';
        }).join('') +
        '<button class="btn btn-ghost btn-sm" type="button" data-add="' + d + '" style="margin-top:auto"><i class="fa-solid fa-plus"></i> Add</button></div>';
    }).join('');
  }

  function onAction(e) {
    var addBtn = e.target.closest('[data-add]');
    if (addBtn) return openSessionModal(null, { date: addBtn.dataset.add });
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'add') return openSessionModal(null);
    var row = btn.closest('[data-id]');
    if (!row) return;
    var s = mine().find(function (x) { return x.id === row.dataset.id; });
    if (!s) return;
    if (btn.dataset.act === 'edit') openSessionModal(s);
    else if (btn.dataset.act === 'toggle') {
      var done = s.status === 'Completed';
      updateData('studySessions', s.id, { status: done ? 'Planned' : 'Completed', updatedAt: new Date().toISOString() });
      logActivity(user.id, 'student', done ? 'Updated study session' : 'Completed study session', s.subject);
      toast(done ? 'Session set back to planned.' : 'Study session completed. Well done!', 'success');
    } else if (btn.dataset.act === 'delete') {
      confirmDialog({ title: 'Delete study session?', message: 'Delete the <b>' + esc(s.subject) + '</b> session on ' + esc(fmtDate(s.date)) + '?', confirmText: 'Delete session' }).then(function (ok) {
        if (ok && deleteData('studySessions', s.id)) { logActivity(user.id, 'student', 'Deleted study session', s.subject); toast('Study session deleted.', 'success'); }
      });
    }
  }

  $('#addBtn').addEventListener('click', function () { openSessionModal(null); });
  ['#todayList', '#upcomingList', '#weekGrid'].forEach(function (sel) {
    $(sel).addEventListener('click', onAction);
    $(sel).addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.sess-chip')) { e.preventDefault(); onAction(e); } });
  });
  $('#prevWeek').addEventListener('click', function () { weekOffset--; render(); });
  $('#nextWeek').addEventListener('click', function () { weekOffset++; render(); });
  $('#thisWeek').addEventListener('click', function () { weekOffset = 0; render(); });

  render();
  onDataChange(render);
})();

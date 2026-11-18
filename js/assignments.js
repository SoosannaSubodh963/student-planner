/* ==========================================================================
   assignments.js — Assignment Tracker (student)
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;

  var STATUSES = ['Not Started', 'In Progress', 'Submitted'];
  var state = { q: '', subject: '', status: '' };

  function mine() { return ownRecords('assignments', user.id); }

  function fillSubjects() {
    var sel = $('#fSubject'), cur = sel.value, set = {};
    mine().forEach(function (a) { if (a.subject) set[a.subject] = 1; });
    sel.innerHTML = '<option value="">All subjects</option>' + Object.keys(set).sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    sel.value = set[cur] ? cur : '';
    state.subject = sel.value;
  }

  function filtered() {
    var q = state.q.toLowerCase();
    return mine().filter(function (a) {
      if (q && (a.title + ' ' + a.subject + ' ' + (a.description || '')).toLowerCase().indexOf(q) === -1) return false;
      if (state.subject && a.subject !== state.subject) return false;
      if (state.status === 'Overdue') return asgIsOverdue(a);
      if (state.status && a.status !== state.status) return false;
      return true;
    }).sort(function (a, b) { return (a.deadline || '9999').localeCompare(b.deadline || '9999'); });
  }

  function render() {
    fillSubjects();
    var all = mine(), s = asgStats(all), list = filtered();
    $('#stats').innerHTML = [
      ['fa-file-lines', 'ic-purple', s.total, 'Total assignments'],
      ['fa-circle-check', 'ic-green', s.submitted, 'Submitted'],
      ['fa-hourglass-half', 'ic-blue', s.pending, 'Pending'],
      ['fa-triangle-exclamation', 'ic-red', s.overdue, 'Overdue']
    ].map(function (c) { return '<div class="card stat-card"><div class="stat-icon ' + c[1] + '"><i class="fa-solid ' + c[0] + '"></i></div><div><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div>'; }).join('');

    $('#rows').innerHTML = list.map(function (a) {
      var overdue = asgIsOverdue(a), submitted = a.status === 'Submitted', info = dueInfo(a.deadline, submitted);
      return '<tr class="' + (overdue ? 'row-overdue' : '') + '" data-id="' + esc(a.id) + '"><td><b>' + esc(a.title) + '</b>' + (a.description ? '<div class="muted small truncate" style="max-width:260px">' + esc(a.description) + '</div>' : '') + '</td>' +
        '<td>' + esc(a.subject) + '</td><td class="nowrap">' + fmtDate(a.assignedDate) + '</td>' +
        '<td class="nowrap"><div>' + fmtDate(a.deadline) + '</div><small class="' + (info.cls === 'warn' ? 'warn-text' : 'muted') + '">' + esc(info.text) + '</small></td>' +
        '<td><div class="rate-cell"><div class="progress thin ' + (submitted ? 'green' : overdue ? 'red' : '') + '"><div style="width:' + a.progress + '%"></div></div><b>' + a.progress + '%</b></div></td>' +
        '<td>' + statusBadge(asgDisplayStatus(a)) + '</td>' +
        '<td><div class="row-actions">' +
        (submitted ? '' : '<button class="icon-btn sm success" type="button" data-act="submit" title="Mark as submitted" aria-label="Mark as submitted"><i class="fa-solid fa-paper-plane"></i></button><button class="icon-btn sm" type="button" data-act="progress" title="Update progress" aria-label="Update progress"><i class="fa-solid fa-bars-progress"></i></button>') +
        '<button class="icon-btn sm" type="button" data-act="edit" title="Edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button><button class="icon-btn sm danger" type="button" data-act="delete" title="Delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button></div></td></tr>';
    }).join('');
    $('.table-wrap').classList.toggle('hidden', !list.length);
    $('#emptyBox').innerHTML = !all.length
      ? emptyState('fa-file-circle-plus', 'No assignments yet', 'Add an assignment to track its progress and deadline.', '<button class="btn btn-primary" type="button" data-act="add"><i class="fa-solid fa-plus"></i> Add assignment</button>')
      : !list.length ? emptyState('fa-magnifying-glass', 'No matching assignments', 'Try changing your search or filters.', '') : '';
  }

  function openForm(a) {
    var t = a || {}, isEdit = !!a;
    var content = '<datalist id="subjectList">' + subjectOptions(user.id).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><div class="form-grid">' +
      fld({ label: 'Assignment title', name: 'title', required: true, full: true, value: t.title || '', maxlength: 120, attrs: 'maxlength="120"', placeholder: 'e.g. Data Structures Assignment 4' }) +
      fld({ label: 'Subject', name: 'subject', required: true, value: t.subject || '', attrs: 'list="subjectList" autocomplete="off" maxlength="60"', placeholder: 'Choose or type a subject' }) +
      fld({ label: 'Submission status', name: 'status', type: 'select', options: STATUSES, value: t.status || 'Not Started' }) +
      fld({ label: 'Description', name: 'description', type: 'textarea', full: true, value: t.description || '', attrs: 'maxlength="800"', placeholder: 'Requirements, format, reference links…' }) +
      fld({ label: 'Assigned date', name: 'assignedDate', type: 'date', required: true, value: t.assignedDate || todayStr() }) +
      fld({ label: 'Submission deadline', name: 'deadline', type: 'date', required: true, value: t.deadline || '' }) +
      '<div class="field full"><label for="f_progress">Progress: <b id="progVal">' + (t.progress || 0) + '%</b></label><input id="f_progress" type="range" name="progress" min="0" max="100" step="5" value="' + (t.progress || 0) + '"></div></div>';
    openModal({
      title: isEdit ? 'Edit Assignment' : 'Add Assignment', content: content,
      submitText: isEdit ? '<i class="fa-solid fa-check"></i> Save Changes' : '<i class="fa-solid fa-plus"></i> Add Assignment',
      onOpen: function (api) {
        var r = api.form.elements.progress, out = $('#progVal', api.el);
        r.addEventListener('input', function () { out.textContent = r.value + '%'; });
      },
      onSubmit: function (f, api, action, form) {
        var errs = {};
        if (!f.title) errs.title = 'Assignment title is required.'; else if (f.title.length < 3) errs.title = 'Title must be at least 3 characters.';
        if (!f.subject) errs.subject = 'Subject is required.';
        if (!f.assignedDate) errs.assignedDate = 'Assigned date is required.';
        if (!f.deadline) errs.deadline = 'Deadline is required.';
        else if (f.assignedDate && f.deadline < f.assignedDate) errs.deadline = 'Deadline cannot be before the assigned date.';
        if (!errs.title && !errs.subject && mine().some(function (x) { return x.id !== t.id && x.title.toLowerCase() === f.title.toLowerCase() && x.subject.toLowerCase() === f.subject.toLowerCase(); })) errs.title = 'You already have an assignment with this title and subject.';
        if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
        var progress = Number(f.progress), status = f.status, now = new Date().toISOString();
        if (status === 'Submitted') progress = 100;
        else if (progress === 0 && status === 'In Progress') status = 'In Progress';
        else if (progress > 0 && status === 'Not Started') status = 'In Progress';
        var rec = { title: f.title, subject: f.subject, description: f.description, assignedDate: f.assignedDate, deadline: f.deadline, status: status, progress: progress, updatedAt: now, submittedAt: status === 'Submitted' ? (t.submittedAt || now) : '' };
        var saved;
        if (isEdit) { saved = updateData('assignments', t.id, rec); if (saved) logActivity(user.id, 'student', status === 'Submitted' && t.status !== 'Submitted' ? 'Submitted assignment' : 'Updated assignment', f.title); }
        else { saved = insertData('assignments', Object.assign(rec, { studentId: user.id })); if (saved) logActivity(user.id, 'student', 'Added assignment', f.title); }
        if (!saved) return;
        toast(isEdit ? 'Assignment updated.' : 'Assignment added.', 'success');
        api.close();
      }
    });
  }

  function openProgress(a) {
    openModal({
      title: 'Update progress', size: 'sm',
      content: '<p class="muted" style="margin-bottom:14px"><b style="color:var(--text)">' + esc(a.title) + '</b></p><div class="field"><label for="p_range">Completed: <b id="pv">' + a.progress + '%</b></label><input id="p_range" type="range" name="progress" min="0" max="100" step="5" value="' + a.progress + '"></div>',
      submitText: '<i class="fa-solid fa-check"></i> Update',
      onOpen: function (api) { var r = api.form.elements.progress; r.addEventListener('input', function () { $('#pv', api.el).textContent = r.value + '%'; }); },
      onSubmit: function (f, api) {
        var p = Number(f.progress);
        updateData('assignments', a.id, { progress: p, status: p === 0 ? 'Not Started' : 'In Progress', updatedAt: new Date().toISOString() });
        logActivity(user.id, 'student', 'Updated assignment', a.title + ' (' + p + '%)');
        toast('Progress updated to ' + p + '%.', 'success');
        api.close();
      }
    });
  }

  function handle(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'add') return openForm();
    var row = btn.closest('tr');
    var a = row && mine().find(function (x) { return x.id === row.dataset.id; });
    if (!a) return;
    if (btn.dataset.act === 'edit') openForm(a);
    else if (btn.dataset.act === 'progress') openProgress(a);
    else if (btn.dataset.act === 'submit') {
      confirmDialog({ title: 'Mark as submitted?', message: 'Mark <b>' + esc(a.title) + '</b> as submitted? Progress will be set to 100%.', confirmText: 'Mark submitted', danger: false, icon: 'fa-paper-plane' }).then(function (ok) {
        if (!ok) return;
        var now = new Date().toISOString();
        updateData('assignments', a.id, { status: 'Submitted', progress: 100, submittedAt: now, updatedAt: now });
        logActivity(user.id, 'student', 'Submitted assignment', a.title);
        toast('Assignment marked as submitted.', 'success');
      });
    } else if (btn.dataset.act === 'delete') {
      confirmDialog({ title: 'Delete assignment?', message: 'Delete <b>' + esc(a.title) + '</b>? This cannot be undone.', confirmText: 'Delete assignment' }).then(function (ok) {
        if (ok && deleteData('assignments', a.id)) { logActivity(user.id, 'student', 'Deleted assignment', a.title); toast('Assignment deleted.', 'success'); }
      });
    }
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  $('#fSubject').addEventListener('change', function (e) { state.subject = e.target.value; render(); });
  $('#fStatus').addEventListener('change', function (e) { state.status = e.target.value; render(); });
  $('#addBtn').addEventListener('click', function () { openForm(); });
  $('#rows').addEventListener('click', handle);
  $('#emptyBox').addEventListener('click', handle);
  render();
  onDataChange(render);
})();

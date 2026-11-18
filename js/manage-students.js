/* ==========================================================================
   manage-students.js — admin: view, edit, activate/deactivate and delete students
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;
  var state = { q: '', dept: '', sem: '', status: '' };

  function students() { return getData('students', []); }

  function fillFilters() {
    var d = $('#fDept'), s = $('#fSem');
    if (!d.options.length) {
      d.innerHTML = '<option value="">All departments</option>' + STP.DEPARTMENTS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
      s.innerHTML = '<option value="">All semesters</option>' + STP.SEMESTERS.map(function (x) { return '<option value="' + x + '">Semester ' + x + '</option>'; }).join('');
    }
  }

  function counts(id) {
    var tasks = ownRecords('tasks', id), asgs = ownRecords('assignments', id);
    return { tasks: tasks, asgs: asgs, ts: taskStats(tasks), as: asgStats(asgs),
      sessions: ownRecords('studySessions', id).length, notes: ownRecords('notes', id).length, todos: ownRecords('todos', id).length };
  }

  function render() {
    fillFilters();
    var all = students(), q = state.q.toLowerCase();
    var list = all.filter(function (s) {
      if (q && (s.name + ' ' + s.rollNo + ' ' + s.email).toLowerCase().indexOf(q) === -1) return false;
      if (state.dept && s.department !== state.dept) return false;
      if (state.sem && String(s.semester) !== state.sem) return false;
      if (state.status && (s.status || 'active') !== state.status) return false;
      return true;
    }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });

    var active = all.filter(function (s) { return s.status !== 'inactive'; }).length;
    $('#stats').innerHTML = [
      ['fa-user-graduate', 'ic-purple', all.length, 'Total students'],
      ['fa-user-check', 'ic-green', active, 'Active accounts'],
      ['fa-user-slash', 'ic-red', all.length - active, 'Inactive accounts'],
      ['fa-building-columns', 'ic-blue', new Set(all.map(function (s) { return s.department; })).size, 'Departments']
    ].map(function (c) { return '<div class="card stat-card"><div class="stat-icon ' + c[1] + '"><i class="fa-solid ' + c[0] + '"></i></div><div><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div>'; }).join('');

    $('#rows').innerHTML = list.map(function (s) {
      var isActive = s.status !== 'inactive';
      return '<tr data-id="' + esc(s.id) + '"><td class="nowrap"><b>' + esc(s.rollNo) + '</b></td><td><div class="cell-user">' + avatarHtml(s, 'sm') + '<b>' + esc(s.name) + '</b></div></td><td>' + esc(s.email) + '</td><td>' + esc(s.department) + '</td><td>Sem ' + esc(s.semester) + '</td><td class="nowrap">' + esc(fmtDate(s.createdAt)) + '</td><td>' + statusBadge(isActive ? 'active' : 'inactive') + '</td>' +
        '<td><div class="row-actions"><button class="icon-btn sm" type="button" data-act="view" title="View profile" aria-label="View profile"><i class="fa-solid fa-eye"></i></button><button class="icon-btn sm" type="button" data-act="edit" title="Edit student" aria-label="Edit student"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="icon-btn sm ' + (isActive ? 'danger' : 'success') + '" type="button" data-act="toggle" title="' + (isActive ? 'Deactivate account' : 'Activate account') + '" aria-label="' + (isActive ? 'Deactivate account' : 'Activate account') + '"><i class="fa-solid ' + (isActive ? 'fa-user-slash' : 'fa-user-check') + '"></i></button>' +
        '<button class="icon-btn sm danger" type="button" data-act="delete" title="Delete student" aria-label="Delete student"><i class="fa-solid fa-trash"></i></button></div></td></tr>';
    }).join('');
    $('.table-wrap').classList.toggle('hidden', !list.length);
    $('#emptyBox').innerHTML = !all.length ? emptyState('fa-user-graduate', 'No students registered', 'Students appear here after they register.', '')
      : !list.length ? emptyState('fa-magnifying-glass', 'No matching students', 'Try changing your search or filters.', '') : '';
  }

  function viewStudent(s) {
    var c = counts(s.id), isActive = s.status !== 'inactive';
    openModal({
      title: 'Student profile', cancelText: 'Close', hideFooter: false, actions: [{ label: '<i class="fa-solid fa-pen"></i> Edit', value: 'edit', cls: 'btn-primary' }],
      content: '<div class="student-profile-head">' + avatarHtml(s, 'lg') + '<div><h3>' + esc(s.name) + '</h3><p class="muted">' + esc(s.email) + '</p><div class="flex gap-8 wrap" style="margin-top:8px"><span class="chip"><i class="fa-solid fa-id-badge"></i>' + esc(s.rollNo) + '</span>' + statusBadge(isActive ? 'active' : 'inactive') + '</div></div></div>' +
        '<div class="sp-stats"><div><b>' + c.ts.total + '</b><span>Tasks</span></div><div><b>' + c.ts.completed + '</b><span>Completed</span></div><div><b class="' + (c.ts.overdue ? 'warn-text' : '') + '">' + c.ts.overdue + '</b><span>Overdue</span></div><div><b>' + c.as.submitted + '/' + c.as.total + '</b><span>Assignments</span></div></div>' +
        '<div style="margin-bottom:14px"><div class="flex between small muted" style="margin-bottom:6px"><span>Task completion</span><b style="color:var(--text)">' + c.ts.rate + '%</b></div><div class="progress"><div style="width:' + c.ts.rate + '%"></div></div></div>' +
        '<div class="kv"><span>Department</span><b>' + esc(s.department) + '</b></div><div class="kv"><span>Semester</span><b>Semester ' + esc(s.semester) + '</b></div><div class="kv"><span>Registered</span><b>' + esc(fmtDate(s.createdAt)) + '</b></div><div class="kv"><span>In progress / pending tasks</span><b>' + c.ts.inProgress + ' / ' + c.ts.pending + '</b></div><div class="kv"><span>Study sessions</span><b>' + c.sessions + '</b></div><div class="kv"><span>Notes · To-dos</span><b>' + c.notes + ' · ' + c.todos + '</b></div>',
      onSubmit: function (f, api) { api.close(); setTimeout(function () { editStudent(s); }, 200); }
    });
  }

  function editStudent(s) {
    openModal({
      title: 'Edit student', content: '<div class="form-grid">' +
        fld({ label: 'Full name', name: 'name', required: true, value: s.name, attrs: 'maxlength="60"' }) +
        fld({ label: 'Student ID / Roll number', name: 'rollNo', required: true, value: s.rollNo, attrs: 'maxlength="20"' }) +
        fld({ label: 'Email', name: 'email', type: 'email', required: true, value: s.email, full: true }) +
        fld({ label: 'Department', name: 'department', type: 'select', required: true, value: s.department, options: STP.DEPARTMENTS }) +
        fld({ label: 'Semester', name: 'semester', type: 'select', required: true, value: s.semester, options: STP.SEMESTERS.map(function (x) { return { value: x, label: 'Semester ' + x }; }) }) +
        fld({ label: 'Reset password (optional)', name: 'password', type: 'password', full: true, attrs: 'autocomplete="new-password"', hint: 'Leave blank to keep the current password.' }) + '</div>',
      submitText: '<i class="fa-solid fa-check"></i> Save Changes',
      onSubmit: function (f, api, action, form) {
        var errs = Auth.validateStudentFields(f, { ignoreId: s.id });
        if (f.password) { var pi = Auth.passwordIssue(f.password); if (pi) errs.password = pi; }
        if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
        var patch = { name: f.name.replace(/\s+/g, ' '), rollNo: f.rollNo, email: Auth.normEmail(f.email), department: f.department, semester: Number(f.semester) };
        if (f.password) patch.passwordHash = hashPassword(f.password);
        if (updateData('students', s.id, patch)) {
          logActivity(admin.id, 'admin', 'Edited student', patch.name);
          toast('Student details updated.', 'success');
          api.close();
        }
      }
    });
  }

  function toggleStudent(s) {
    var isActive = s.status !== 'inactive';
    function apply() {
      updateData('students', s.id, { status: isActive ? 'inactive' : 'active' });
      logActivity(admin.id, 'admin', isActive ? 'Deactivated student' : 'Activated student', s.name);
      toast(s.name + (isActive ? ' has been deactivated.' : ' has been activated.'), 'success');
    }
    if (!isActive) return apply();
    confirmDialog({ title: 'Deactivate account?', message: '<b>' + esc(s.name) + '</b> will no longer be able to log in. Their data is kept and the account can be reactivated at any time.', confirmText: 'Deactivate', icon: 'fa-user-slash' }).then(function (ok) { if (ok) apply(); });
  }

  function deleteStudent(s) {
    var c = counts(s.id);
    confirmDialog({
      title: 'Delete student account?',
      message: 'Permanently delete <b>' + esc(s.name) + '</b> and all of their records: ' + plural(c.tasks.length, 'task') + ', ' + plural(c.asgs.length, 'assignment') + ', ' + plural(c.sessions, 'study session') + ', ' + plural(c.notes, 'note') + ' and ' + plural(c.todos, 'to-do item') + '? This cannot be undone.',
      confirmText: 'Delete student'
    }).then(function (ok) {
      if (!ok) return;
      ['tasks', 'assignments', 'studySessions', 'todos', 'notes', 'notifications'].forEach(function (k) {
        deleteWhere(k, function (r) { return r.studentId === s.id; });
      });
      deleteWhere('activityLogs', function (l) { return l.userId === s.id; });
      var settings = getData('settings', {});
      if (settings.userPrefs && settings.userPrefs[s.id]) { delete settings.userPrefs[s.id]; saveData('settings', settings); }
      deleteData('students', s.id);
      logActivity(admin.id, 'admin', 'Deleted student', s.name);
      toast('Student account and related records deleted.', 'success');
    });
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  $('#fDept').addEventListener('change', function (e) { state.dept = e.target.value; render(); });
  $('#fSem').addEventListener('change', function (e) { state.sem = e.target.value; render(); });
  $('#fStatus').addEventListener('change', function (e) { state.status = e.target.value; render(); });
  $('#clearBtn').addEventListener('click', function () {
    state = { q: '', dept: '', sem: '', status: '' };
    $('#q').value = ''; $('#fDept').value = ''; $('#fSem').value = ''; $('#fStatus').value = '';
    render();
  });
  $('#rows').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var s = students().find(function (x) { return x.id === btn.closest('tr').dataset.id; });
    if (!s) return;
    ({ view: viewStudent, edit: editStudent, toggle: toggleStudent, delete: deleteStudent })[btn.dataset.act](s);
  });

  render();
  onDataChange(render);
})();

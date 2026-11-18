/* ==========================================================================
   admin-announcements.js — create, edit, publish, unpublish and delete announcements
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;
  var state = { q: '', view: 'all' };

  var PRI = { High: { icon: 'fa-circle-exclamation', cls: 'ic-red' }, Medium: { icon: 'fa-bullhorn', cls: 'ic-amber' }, Low: { icon: 'fa-circle-info', cls: 'ic-blue' } };

  function all() { return getData('announcements', []); }
  function phase(a) {
    if (a.status !== 'Published') return 'Draft';
    return a.publishDate > todayStr() ? 'Scheduled' : 'Published';
  }
  function audienceLabel(a) {
    if (a.audience === 'department') return a.department || 'Department';
    if (a.audience === 'semester') return 'Semester ' + a.semester;
    return 'All students';
  }
  function reach(a) {
    return getData('students', []).filter(function (s) {
      if (s.status === 'inactive') return false;
      if (a.audience === 'department') return s.department === a.department;
      if (a.audience === 'semester') return Number(s.semester) === Number(a.semester);
      return true;
    }).length;
  }

  function render() {
    var list = all(), q = state.q.toLowerCase();
    var counts = { all: list.length, Published: 0, Scheduled: 0, Draft: 0 };
    list.forEach(function (a) { counts[phase(a)]++; });
    $('#pills').innerHTML = [['all', 'All'], ['Published', 'Published'], ['Scheduled', 'Scheduled'], ['Draft', 'Drafts']].map(function (p) {
      return '<button class="pill' + (state.view === p[0] ? ' active' : '') + '" type="button" data-view="' + p[0] + '">' + p[1] + '<span class="count">' + counts[p[0]] + '</span></button>';
    }).join('');
    var shown = list.filter(function (a) {
      if (state.view !== 'all' && phase(a) !== state.view) return false;
      return !q || (a.title + ' ' + a.description).toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return b.publishDate.localeCompare(a.publishDate) || b.createdAt.localeCompare(a.createdAt); });

    $('#annList').innerHTML = shown.length ? shown.map(function (a, i) {
      var p = PRI[a.priority] || PRI.Low, ph = phase(a);
      return '<article class="adm-ann' + (ph === 'Draft' ? ' draft' : '') + '" style="animation-delay:' + Math.min(i, 10) * 35 + 'ms" data-id="' + esc(a.id) + '"><div class="ann-ic ' + p.cls + '"><i class="fa-solid ' + p.icon + '"></i></div>' +
        '<div class="grow" style="min-width:0"><h3>' + esc(a.title) + '</h3><p>' + esc(a.description) + '</p><div class="a-meta">' + statusBadge(ph) + priorityBadge(a.priority) + '<span class="chip"><i class="fa-solid fa-users"></i>' + esc(audienceLabel(a)) + ' · ' + plural(reach(a), 'student') + '</span><span class="chip"><i class="fa-regular fa-calendar"></i>' + esc(fmtDate(a.publishDate)) + '</span></div></div>' +
        '<div class="a-actions">' + (ph === 'Draft' ? '<button class="btn btn-primary btn-sm" type="button" data-act="publish"><i class="fa-solid fa-paper-plane"></i> Publish</button>' : '<button class="btn btn-secondary btn-sm" type="button" data-act="unpublish"><i class="fa-solid fa-eye-slash"></i> Unpublish</button>') +
        '<button class="icon-btn sm" type="button" data-act="edit" title="Edit" aria-label="Edit announcement"><i class="fa-solid fa-pen"></i></button><button class="icon-btn sm danger" type="button" data-act="delete" title="Delete" aria-label="Delete announcement"><i class="fa-solid fa-trash"></i></button></div></article>';
    }).join('') : emptyState('fa-bullhorn', list.length ? 'No matching announcements' : 'No announcements yet', list.length ? 'Try a different search or tab.' : 'Create your first announcement to reach students.',
      list.length ? '' : '<button class="btn btn-primary" type="button" data-act="add"><i class="fa-solid fa-plus"></i> New announcement</button>');
  }

  function openForm(a) {
    var t = a || {}, isEdit = !!a;
    var deptOpts = [{ value: '', label: 'Select department' }].concat(STP.DEPARTMENTS.map(function (d) { return { value: d, label: d }; }));
    var semOpts = [{ value: '', label: 'Select semester' }].concat(STP.SEMESTERS.map(function (s) { return { value: s, label: 'Semester ' + s }; }));
    openModal({
      title: isEdit ? 'Edit Announcement' : 'New Announcement', size: 'lg',
      content: '<div class="form-grid">' +
        fld({ label: 'Title', name: 'title', required: true, full: true, value: t.title || '', attrs: 'maxlength="120"', placeholder: 'e.g. Mid-semester exam schedule' }) +
        fld({ label: 'Description', name: 'description', type: 'textarea', required: true, full: true, value: t.description || '', attrs: 'rows="5" maxlength="1500"', placeholder: 'Write the full announcement…' }) +
        fld({ label: 'Target audience', name: 'audience', type: 'select', value: t.audience || 'all', options: [{ value: 'all', label: 'All students' }, { value: 'department', label: 'Specific department' }, { value: 'semester', label: 'Specific semester' }] }) +
        fld({ label: 'Priority', name: 'priority', type: 'select', value: t.priority || 'Medium', options: PRIORITIES }) +
        fld({ label: 'Department', name: 'department', type: 'select', value: t.department || '', options: deptOpts }) +
        fld({ label: 'Semester', name: 'semester', type: 'select', value: t.semester || '', options: semOpts }) +
        fld({ label: 'Publication date', name: 'publishDate', type: 'date', required: true, full: true, value: t.publishDate || todayStr(), hint: 'Published announcements with a future date appear to students automatically on that day.' }) + '</div>',
      actions: [{ label: '<i class="fa-regular fa-floppy-disk"></i> Save as draft', value: 'draft', cls: 'btn-secondary' }, { label: '<i class="fa-solid fa-paper-plane"></i> ' + (isEdit && t.status === 'Published' ? 'Save &amp; publish' : 'Publish'), value: 'publish', cls: 'btn-primary' }],
      onOpen: function (api) {
        var f = api.form;
        function sync() {
          f.elements.department.disabled = f.elements.audience.value !== 'department';
          f.elements.semester.disabled = f.elements.audience.value !== 'semester';
        }
        f.elements.audience.addEventListener('change', sync);
        sync();
      },
      onSubmit: function (f, api, action, form) {
        var errs = {}, audience = form.elements.audience.value;
        var dept = form.elements.department.value, sem = form.elements.semester.value;
        if (!f.title) errs.title = 'Title is required.'; else if (f.title.length < 3) errs.title = 'Title must be at least 3 characters.';
        if (!f.description) errs.description = 'Description is required.'; else if (f.description.length < 10) errs.description = 'Description must be at least 10 characters.';
        if (audience === 'department' && !dept) errs.department = 'Select the target department.';
        if (audience === 'semester' && !sem) errs.semester = 'Select the target semester.';
        if (!f.publishDate) errs.publishDate = 'Choose a publication date.';
        if (!errs.title && all().some(function (x) { return x.id !== t.id && x.title.toLowerCase() === f.title.toLowerCase() && x.audience === audience && String(x.department || '') === (audience === 'department' ? dept : '') && String(x.semester || '') === (audience === 'semester' ? sem : '') && x.publishDate === f.publishDate; })) errs.title = 'An identical announcement already exists.';
        if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
        var me = getCurrentUser() || admin;
        var rec = {
          title: f.title, description: f.description, audience: audience,
          department: audience === 'department' ? dept : '', semester: audience === 'semester' ? Number(sem) : '',
          priority: f.priority, publishDate: f.publishDate, status: action === 'publish' ? 'Published' : 'Draft',
          adminName: me.name, updatedAt: new Date().toISOString()
        };
        var saved;
        if (isEdit) saved = updateData('announcements', t.id, rec);
        else saved = insertData('announcements', rec);
        if (!saved) return;
        logActivity(admin.id, 'admin', action === 'publish' ? 'Published announcement' : (isEdit ? 'Updated announcement' : 'Saved announcement draft'), f.title);
        toast(action === 'publish' ? (f.publishDate > todayStr() ? 'Announcement scheduled for ' + fmtDate(f.publishDate) + '.' : 'Announcement published to ' + plural(reach(saved), 'student') + '.') : 'Draft saved.', 'success');
        api.close();
      }
    });
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  $('#pills').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]');
    if (b) { state.view = b.dataset.view; render(); }
  });
  $('#addBtn').addEventListener('click', function () { openForm(); });
  $('#annList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'add') return openForm();
    var a = all().find(function (x) { return x.id === btn.closest('.adm-ann').dataset.id; });
    if (!a) return;
    if (btn.dataset.act === 'edit') openForm(a);
    else if (btn.dataset.act === 'publish') {
      updateData('announcements', a.id, { status: 'Published', adminName: (getCurrentUser() || admin).name, updatedAt: new Date().toISOString() });
      logActivity(admin.id, 'admin', 'Published announcement', a.title);
      toast(a.publishDate > todayStr() ? 'Announcement scheduled for ' + fmtDate(a.publishDate) + '.' : 'Announcement published.', 'success');
    } else if (btn.dataset.act === 'unpublish') {
      updateData('announcements', a.id, { status: 'Draft', updatedAt: new Date().toISOString() });
      logActivity(admin.id, 'admin', 'Unpublished announcement', a.title);
      toast('Announcement moved back to drafts.', 'success');
    } else if (btn.dataset.act === 'delete') {
      confirmDialog({ title: 'Delete announcement?', message: 'Delete <b>' + esc(a.title) + '</b>? Students will no longer see it.', confirmText: 'Delete announcement' }).then(function (ok) {
        if (ok && deleteData('announcements', a.id)) { logActivity(admin.id, 'admin', 'Deleted announcement', a.title); toast('Announcement deleted.', 'success'); }
      });
    }
  });

  render();
  onDataChange(render);
})();

/* ==========================================================================
   notes.js — personal notes (student-owned): CRUD, search, subject filter
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;
  var state = { q: '', subject: '' };

  function mine() { return ownRecords('notes', user.id); }
  function colorFor(subject) {
    var h = 0, s = String(subject || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % CHART_COLORS.length;
    return CHART_COLORS[h];
  }

  function fillSubjects() {
    var sel = $('#fSubject'), cur = sel.value, set = {};
    mine().forEach(function (n) { if (n.subject) set[n.subject] = 1; });
    sel.innerHTML = '<option value="">All subjects</option>' + Object.keys(set).sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    sel.value = set[cur] ? cur : '';
    state.subject = sel.value;
  }

  function render() {
    fillSubjects();
    var all = mine(), q = state.q.toLowerCase();
    var list = all.filter(function (n) {
      if (state.subject && n.subject !== state.subject) return false;
      return !q || (n.title + ' ' + n.subject + ' ' + n.content).toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    var grid = $('#notesGrid');
    if (!list.length) {
      grid.className = '';
      grid.innerHTML = all.length ? emptyState('fa-magnifying-glass', 'No matching notes', 'Try a different search or subject.', '')
        : emptyState('fa-note-sticky', 'No notes yet', 'Capture formulas, summaries and ideas in your first note.', '<button class="btn btn-primary" type="button" data-act="add"><i class="fa-solid fa-plus"></i> Create a note</button>');
      return;
    }
    grid.className = 'notes-grid';
    grid.innerHTML = list.map(function (n, i) {
      var edited = n.updatedAt && n.updatedAt !== n.createdAt;
      return '<article class="note-card" style="--nc:' + colorFor(n.subject) + ';animation-delay:' + Math.min(i, 12) * 30 + 'ms" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-label="Open note ' + esc(n.title) + '"><h4>' + esc(n.title) + '</h4><p>' + esc(n.content) + '</p>' +
        '<div class="nc-foot"><span class="chip">' + esc(n.subject || 'General') + '</span><span title="Created ' + esc(fmtDate(n.createdAt)) + '">' + (edited ? 'Updated ' : 'Created ') + esc(fmtDate(edited ? n.updatedAt : n.createdAt)) + '</span></div></article>';
    }).join('');
  }

  function openForm(note) {
    var n = note || {}, isEdit = !!note;
    openModal({
      title: isEdit ? 'Edit Note' : 'New Note', size: 'lg',
      content: '<datalist id="subjectList">' + subjectOptions(user.id).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><div class="form-grid">' +
        fld({ label: 'Title', name: 'title', required: true, value: n.title || '', attrs: 'maxlength="100"', placeholder: 'Note title' }) +
        fld({ label: 'Subject', name: 'subject', required: true, value: n.subject || '', attrs: 'list="subjectList" autocomplete="off" maxlength="60"', placeholder: 'Choose or type a subject' }) +
        fld({ label: 'Content', name: 'content', type: 'textarea', required: true, full: true, value: n.content || '', attrs: 'rows="9" maxlength="5000"', placeholder: 'Write your note here…' }) + '</div>',
      submitText: isEdit ? '<i class="fa-solid fa-check"></i> Save Note' : '<i class="fa-solid fa-plus"></i> Create Note',
      onSubmit: function (f, api, action, form) {
        var errs = {};
        if (!f.title) errs.title = 'Title is required.';
        if (!f.subject) errs.subject = 'Subject is required.';
        if (!f.content) errs.content = 'Note content cannot be empty.';
        if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
        var now = new Date().toISOString(), saved;
        if (isEdit) { saved = updateData('notes', n.id, { title: f.title, subject: f.subject, content: f.content, updatedAt: now }); if (saved) logActivity(user.id, 'student', 'Updated note', f.title); }
        else { saved = insertData('notes', { studentId: user.id, title: f.title, subject: f.subject, content: f.content, updatedAt: now }); if (saved) logActivity(user.id, 'student', 'Added note', f.title); }
        if (!saved) return;
        toast(isEdit ? 'Note updated.' : 'Note created.', 'success');
        api.close();
      }
    });
  }

  function openView(n) {
    openModal({
      title: 'Note', size: 'lg', cancelText: 'Close',
      content: '<h3 style="margin-bottom:8px;word-break:break-word">' + esc(n.title) + '</h3><div class="flex gap-8 wrap center" style="margin-bottom:14px"><span class="chip"><i class="fa-solid fa-book"></i>' + esc(n.subject || 'General') + '</span><span class="muted small"><i class="fa-regular fa-calendar-plus"></i> Created ' + esc(fmtDate(n.createdAt)) + '</span><span class="muted small"><i class="fa-regular fa-pen-to-square"></i> Updated ' + esc(fmtDate(n.updatedAt)) + '</span></div><div class="note-content">' + esc(n.content) + '</div>',
      actions: [{ label: '<i class="fa-solid fa-trash"></i> Delete', value: 'delete', cls: 'btn-danger' }, { label: '<i class="fa-solid fa-pen"></i> Edit', value: 'edit', cls: 'btn-primary' }],
      onSubmit: function (f, api, action) {
        api.close();
        if (action === 'edit') setTimeout(function () { openForm(n); }, 200);
        else setTimeout(function () {
          confirmDialog({ title: 'Delete note?', message: 'Delete <b>' + esc(n.title) + '</b>? This cannot be undone.', confirmText: 'Delete note' }).then(function (ok) {
            if (ok && deleteData('notes', n.id)) { logActivity(user.id, 'student', 'Deleted note', n.title); toast('Note deleted.', 'success'); }
          });
        }, 200);
      }
    });
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  $('#fSubject').addEventListener('change', function (e) { state.subject = e.target.value; render(); });
  $('#addBtn').addEventListener('click', function () { openForm(); });
  function openFromEvent(e) {
    var add = e.target.closest('[data-act="add"]');
    if (add) return openForm();
    var c = e.target.closest('.note-card');
    if (!c) return;
    var n = mine().find(function (x) { return x.id === c.dataset.id; });
    if (n) openView(n);
  }
  $('#notesGrid').addEventListener('click', openFromEvent);
  $('#notesGrid').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromEvent(e); } });
  render();
  onDataChange(render);
})();

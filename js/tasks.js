/* ==========================================================================
   tasks.js — My Tasks: full CRUD, search, filters and sorting
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;

  var params = new URLSearchParams(location.search);
  var state = { q: '', subject: '', priority: '', status: '', sort: 'due-asc' };

  function mine() { return ownRecords('tasks', user.id); }

  function fillSubjects() {
    var sel = $('#fSubject'), cur = sel.value;
    var subjects = {};
    mine().forEach(function (t) { if (t.subject) subjects[t.subject] = 1; });
    sel.innerHTML = '<option value="">All subjects</option>' + Object.keys(subjects).sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    sel.value = subjects[cur] ? cur : '';
    state.subject = sel.value;
  }

  function filtered() {
    var q = state.q.toLowerCase();
    var list = mine().filter(function (t) {
      if (q && (t.title + ' ' + t.subject + ' ' + (t.description || '') + ' ' + t.category).toLowerCase().indexOf(q) === -1) return false;
      if (state.subject && t.subject !== state.subject) return false;
      if (state.priority && t.priority !== state.priority) return false;
      if (state.status === 'Open') return t.status !== 'Completed';
      if (state.status === 'Overdue') return taskIsOverdue(t);
      if (state.status && t.status !== state.status) return false;
      return true;
    });
    list.sort(function (a, b) {
      switch (state.sort) {
        case 'due-desc': return (b.dueDate || '').localeCompare(a.dueDate || '');
        case 'created-desc': return b.createdAt.localeCompare(a.createdAt);
        case 'created-asc': return a.createdAt.localeCompare(b.createdAt);
        default: return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      }
    });
    return list;
  }

  function card(t, i) {
    var overdue = taskIsOverdue(t), done = t.status === 'Completed', info = dueInfo(t.dueDate, done);
    return '<article class="task-card p-' + esc(String(t.priority).toLowerCase()) + (overdue ? ' is-overdue' : '') + (done ? ' is-done' : '') + '" style="animation-delay:' + Math.min(i, 12) * 30 + 'ms" data-id="' + esc(t.id) + '">' +
      '<div class="tc-top"><div class="flex gap-12" style="align-items:flex-start;min-width:0"><button class="check-btn' + (done ? ' on' : '') + '" type="button" data-act="toggle" title="' + (done ? 'Mark as pending' : 'Mark as completed') + '" aria-label="' + (done ? 'Mark as pending' : 'Mark as completed') + '"><i class="fa-solid fa-check"></i></button><h3 class="tc-title">' + esc(t.title) + '</h3></div>' + priorityBadge(t.priority) + '</div>' +
      (t.description ? '<p class="tc-desc">' + esc(t.description) + '</p>' : '') +
      '<div class="tc-meta"><span class="chip"><i class="fa-solid fa-book"></i>' + esc(t.subject) + '</span><span class="chip"><i class="fa-solid fa-tag"></i>' + esc(t.category) + '</span>' + (t.estimatedHours ? '<span class="chip"><i class="fa-regular fa-clock"></i>' + esc(t.estimatedHours) + ' h</span>' : '') + '</div>' +
      '<div class="tc-due ' + info.cls + '"><i class="fa-regular fa-calendar"></i>' + esc(fmtDate(t.dueDate)) + ' · ' + esc(info.text) + (overdue ? ' <span class="warn-ribbon"><i class="fa-solid fa-triangle-exclamation"></i> OVERDUE</span>' : '') + '</div>' +
      '<div class="tc-foot"><select class="status-select" data-act="status" aria-label="Change status">' + TASK_STATUSES.map(function (s) { return '<option' + (s === t.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<div class="row-actions"><button class="icon-btn sm" type="button" data-act="view" title="View details" aria-label="View details"><i class="fa-solid fa-eye"></i></button><button class="icon-btn sm" type="button" data-act="edit" title="Edit" aria-label="Edit task"><i class="fa-solid fa-pen"></i></button><button class="icon-btn sm danger" type="button" data-act="delete" title="Delete" aria-label="Delete task"><i class="fa-solid fa-trash"></i></button></div></div></article>';
  }

  function render() {
    fillSubjects();
    var all = mine(), list = filtered(), s = taskStats(all);
    $('#miniStats').innerHTML = '<span class="chip"><i class="fa-solid fa-list"></i> ' + s.total + ' total</span><span class="chip"><i class="fa-solid fa-circle-check" style="color:var(--success)"></i> ' + s.completed + ' done</span>' +
      (s.overdue ? '<span class="chip" style="color:var(--danger);border-color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ' + s.overdue + ' overdue</span>' : '');
    $('#resultCount').textContent = 'Showing ' + list.length + ' of ' + all.length + ' tasks';
    var box = $('#taskList');
    if (!all.length) {
      box.className = '';
      box.innerHTML = emptyState('fa-clipboard-list', 'No tasks yet', 'Create your first task to start organising your work.', '<button class="btn btn-primary" type="button" data-act="add"><i class="fa-solid fa-plus"></i> Add your first task</button>');
    } else if (!list.length) {
      box.className = '';
      box.innerHTML = emptyState('fa-magnifying-glass', 'No matching tasks', 'Try a different search term or clear the filters.', '<button class="btn btn-secondary" type="button" data-act="clear"><i class="fa-solid fa-filter-circle-xmark"></i> Clear filters</button>');
    } else {
      box.className = 'task-grid';
      box.innerHTML = list.map(card).join('');
    }
  }

  function details(t) {
    var overdue = taskIsOverdue(t);
    var api = openModal({
      title: 'Task details', size: '', cancelText: 'Close',
      content: '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + priorityBadge(t.priority) + statusBadge(taskDisplayStatus(t)) + '<span class="chip">' + esc(t.category) + '</span></div><h3 style="margin-bottom:6px;word-break:break-word">' + esc(t.title) + '</h3><p class="muted" style="white-space:pre-line;margin-bottom:16px">' + esc(t.description || 'No description provided.') + '</p>' +
        '<dl class="detail-grid"><div><dt>Subject</dt><dd>' + esc(t.subject) + '</dd></div><div><dt>Estimated time</dt><dd>' + (t.estimatedHours ? esc(t.estimatedHours) + ' hours' : '—') + '</dd></div><div><dt>Start date</dt><dd>' + fmtDate(t.startDate) + '</dd></div><div><dt>Due date</dt><dd class="' + (overdue ? 'warn-text' : '') + '">' + fmtDate(t.dueDate) + ' (' + esc(dueInfo(t.dueDate, t.status === 'Completed').text) + ')</dd></div><div><dt>Created</dt><dd>' + fmtDate(t.createdAt) + '</dd></div><div><dt>' + (t.status === 'Completed' ? 'Completed' : 'Last updated') + '</dt><dd>' + fmtDate(t.status === 'Completed' && t.completedAt ? t.completedAt : t.updatedAt || t.createdAt) + '</dd></div></dl>',
      actions: [{ label: '<i class="fa-solid fa-pen"></i> Edit', value: 'edit', cls: 'btn-primary' }],
      onSubmit: function (d, m) { m.close(); setTimeout(function () { openTaskModal(t, { onSaved: render }); }, 200); }
    });
    return api;
  }

  function setStatus(t, status) {
    var now = new Date().toISOString();
    updateData('tasks', t.id, { status: status, updatedAt: now, completedAt: status === 'Completed' ? now : '' });
    logActivity(user.id, 'student', status === 'Completed' ? 'Completed task' : 'Updated task', t.title);
    toast(status === 'Completed' ? 'Great job! Task marked as completed.' : 'Task status changed to ' + status + '.', 'success');
  }

  function bindEvents() {
    $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
    $('#fSubject').addEventListener('change', function (e) { state.subject = e.target.value; render(); });
    $('#fPriority').addEventListener('change', function (e) { state.priority = e.target.value; render(); });
    $('#fStatus').addEventListener('change', function (e) { state.status = e.target.value; render(); });
    $('#fSort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
    function clear() {
      state = { q: '', subject: '', priority: '', status: '', sort: state.sort };
      $('#q').value = ''; $('#fPriority').value = ''; $('#fStatus').value = ''; $('#fSubject').value = '';
      render();
    }
    $('#clearBtn').addEventListener('click', clear);
    $('#addBtn').addEventListener('click', function () { openTaskModal(null, { onSaved: render }); });
    $('#taskList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'add') return openTaskModal(null, { onSaved: render });
      if (act === 'clear') return clear();
      var cardEl = btn.closest('.task-card');
      if (!cardEl) return;
      var t = mine().find(function (x) { return x.id === cardEl.dataset.id; });
      if (!t) return;
      if (act === 'toggle') setStatus(t, t.status === 'Completed' ? 'Pending' : 'Completed');
      else if (act === 'view') details(t);
      else if (act === 'edit') openTaskModal(t, { onSaved: render });
      else if (act === 'delete') {
        confirmDialog({ title: 'Delete task?', message: 'Delete <b>' + esc(t.title) + '</b>? This cannot be undone.', confirmText: 'Delete task' }).then(function (ok) {
          if (!ok) return;
          if (deleteData('tasks', t.id)) { logActivity(user.id, 'student', 'Deleted task', t.title); toast('Task deleted.', 'success'); }
        });
      }
    });
    $('#taskList').addEventListener('change', function (e) {
      if (e.target.dataset.act !== 'status') return;
      var t = mine().find(function (x) { return x.id === e.target.closest('.task-card').dataset.id; });
      if (t) setStatus(t, e.target.value);
    });
  }

  bindEvents();
  // deep links: ?status=Overdue, ?view=<id>, ?add=1&date=YYYY-MM-DD
  var st = params.get('status');
  if (st && ['Open', 'Pending', 'In Progress', 'Completed', 'Overdue'].indexOf(st) > -1) { state.status = st; $('#fStatus').value = st; }
  render();
  onDataChange(render);
  var viewId = params.get('view');
  if (viewId) {
    var vt = mine().find(function (x) { return x.id === viewId; });
    if (vt) setTimeout(function () { details(vt); }, 380);
  }
  if (params.get('add') === '1') {
    var d = params.get('date');
    setTimeout(function () { openTaskModal(null, { defaults: d ? { dueDate: d } : {}, onSaved: render }); }, 380);
  }
})();

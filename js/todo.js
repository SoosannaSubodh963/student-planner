/* ==========================================================================
   todo.js — simple daily checklist (student-owned items only)
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;
  var filter = 'all';

  function mine() { return ownRecords('todos', user.id); }

  function render() {
    var all = mine();
    var done = all.filter(function (t) { return t.done; }).length, pending = all.length - done;
    var pct = all.length ? Math.round(done / all.length * 100) : 0;

    $('#pills').innerHTML = [['all', 'All', all.length], ['pending', 'Pending', pending], ['completed', 'Completed', done]].map(function (p) {
      return '<button class="pill' + (filter === p[0] ? ' active' : '') + '" type="button" data-filter="' + p[0] + '">' + p[1] + '<span class="count">' + p[2] + '</span></button>';
    }).join('');
    $('#clearDone').disabled = !done;
    $('#ring').style.setProperty('--p', pct);
    $('#ringText').textContent = pct + '%';
    $('#legend').innerHTML = '<div><span><i class="sw" style="background:#10b981"></i>Completed</span><b>' + done + '</b></div><div><span><i class="sw" style="background:#60a5fa"></i>Pending</span><b>' + pending + '</b></div><div><span><i class="sw" style="background:#8b5cf6"></i>Total</span><b>' + all.length + '</b></div>';

    var list = all.filter(function (t) { return filter === 'all' || (filter === 'completed' ? t.done : !t.done); })
      .sort(function (a, b) { return (a.done - b.done) || b.createdAt.localeCompare(a.createdAt); });
    $('#todoList').innerHTML = list.length ? list.map(function (t) {
      return '<div class="todo-item' + (t.done ? ' done' : '') + '" data-id="' + esc(t.id) + '"><button class="check-btn' + (t.done ? ' on' : '') + '" type="button" data-act="toggle" aria-label="' + (t.done ? 'Mark as pending' : 'Mark as done') + '"><i class="fa-solid fa-check"></i></button><span class="t-text">' + esc(t.text) + '</span><div class="row-actions"><button class="icon-btn sm" type="button" data-act="edit" aria-label="Edit item"><i class="fa-solid fa-pen"></i></button><button class="icon-btn sm danger" type="button" data-act="delete" aria-label="Delete item"><i class="fa-solid fa-trash"></i></button></div></div>';
    }).join('') : (all.length
      ? emptyState('fa-filter', filter === 'completed' ? 'Nothing completed yet' : 'All done!', filter === 'completed' ? 'Complete an item and it will show up here.' : 'You have no pending items. Nice work!', '', true)
      : emptyState('fa-list-check', 'Your checklist is empty', 'Add your first to-do item above.', '', true));
  }

  function validText(text, ignoreId) {
    if (!text) return 'Please enter something to do.';
    if (text.length < 2) return 'Item must be at least 2 characters.';
    if (text.length > 140) return 'Item is too long (140 characters max).';
    if (mine().some(function (t) { return t.id !== ignoreId && !t.done && t.text.toLowerCase() === text.toLowerCase(); })) return 'This item is already on your list.';
    return '';
  }

  $('#addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#todoText'), text = input.value.trim().replace(/\s+/g, ' '), err = validText(text);
    $('#addErr').textContent = err;
    input.classList.toggle('invalid', !!err);
    if (err) { input.focus(); return; }
    if (insertData('todos', { studentId: user.id, text: text, done: false, completedAt: '' })) {
      logActivity(user.id, 'student', 'Added to-do', text);
      input.value = '';
      toast('To-do item added.', 'success');
      input.focus();
    }
  });
  $('#todoText').addEventListener('input', function (e) { e.target.classList.remove('invalid'); $('#addErr').textContent = ''; });

  $('#pills').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) { filter = b.dataset.filter; render(); }
  });

  $('#clearDone').addEventListener('click', function () {
    var n = mine().filter(function (t) { return t.done; }).length;
    if (!n) return;
    confirmDialog({ title: 'Clear completed items?', message: 'Remove ' + plural(n, 'completed item') + ' from your list?', confirmText: 'Clear completed' }).then(function (ok) {
      if (!ok) return;
      deleteWhere('todos', function (t) { return t.studentId === user.id && t.done; });
      logActivity(user.id, 'student', 'Cleared completed to-dos', plural(n, 'item'));
      toast('Completed items cleared.', 'success');
    });
  });

  $('#todoList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = btn.closest('.todo-item');
    var t = mine().find(function (x) { return x.id === row.dataset.id; });
    if (!t) return;
    if (btn.dataset.act === 'toggle') {
      updateData('todos', t.id, { done: !t.done, completedAt: t.done ? '' : new Date().toISOString() });
      if (!t.done) logActivity(user.id, 'student', 'Completed to-do', t.text);
    } else if (btn.dataset.act === 'edit') {
      openModal({
        title: 'Edit to-do item', size: 'sm',
        content: fld({ label: 'To-do item', name: 'text', required: true, value: t.text, attrs: 'maxlength="140"' }),
        submitText: '<i class="fa-solid fa-check"></i> Save',
        onSubmit: function (f, api, action, form) {
          var text = f.text.replace(/\s+/g, ' '), err = validText(text, t.id);
          if (err) { showFieldErrors(form, { text: err }); return; }
          updateData('todos', t.id, { text: text });
          toast('To-do item updated.', 'success');
          api.close();
        }
      });
    } else if (btn.dataset.act === 'delete') {
      confirmDialog({ title: 'Delete item?', message: 'Delete <b>' + esc(t.text) + '</b>?', confirmText: 'Delete' }).then(function (ok) {
        if (ok && deleteData('todos', t.id)) toast('To-do item deleted.', 'success');
      });
    }
  });

  render();
  onDataChange(render);
})();

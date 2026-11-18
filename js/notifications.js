/* ==========================================================================
   notifications.js — in-app notifications (generated in common.js, managed here)
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;
  var filter = 'all';

  function mine() {
    return ownRecords('notifications', user.id).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
  }
  // Deleted notifications are remembered so the generator does not recreate them.
  function dismiss(refKeys) {
    var prefs = getPrefs(user.id);
    var merged = prefs.dismissed.concat(refKeys.filter(function (k) { return prefs.dismissed.indexOf(k) === -1; }));
    setPrefs(user.id, { dismissed: merged.slice(-500) });
  }

  function render() {
    var all = mine(), unread = all.filter(function (n) { return !n.read; }).length;
    $('#pills').innerHTML = [['all', 'All', all.length], ['unread', 'Unread', unread]].map(function (p) {
      return '<button class="pill' + (filter === p[0] ? ' active' : '') + '" type="button" data-filter="' + p[0] + '">' + p[1] + '<span class="count">' + p[2] + '</span></button>';
    }).join('');
    $('#markAll').disabled = !unread;
    $('#clearAll').disabled = !all.length;
    var list = filter === 'unread' ? all.filter(function (n) { return !n.read; }) : all;
    $('#notifList').innerHTML = list.length ? list.map(function (n, i) {
      var st = notifIcon(n);
      return '<div class="notif-item' + (n.read ? '' : ' unread') + '" style="animation-delay:' + Math.min(i, 10) * 30 + 'ms" data-id="' + esc(n.id) + '" data-link="' + esc(n.link || '') + '"><div class="n-ic ' + st.cls + '"><i class="fa-solid ' + st.icon + '"></i></div>' +
        '<div class="n-body" style="cursor:pointer" data-act="open"><b>' + esc(n.title) + '</b><p>' + esc(n.message) + '</p><small>' + esc(timeAgo(n.createdAt)) + '</small></div>' +
        '<div class="notif-actions">' + (n.read ? '' : '<button class="icon-btn sm success" type="button" data-act="read" title="Mark as read" aria-label="Mark as read"><i class="fa-solid fa-check"></i></button>') + '<button class="icon-btn sm danger" type="button" data-act="delete" title="Delete" aria-label="Delete notification"><i class="fa-solid fa-trash"></i></button></div></div>';
    }).join('') : emptyState(filter === 'unread' ? 'fa-check-double' : 'fa-bell-slash', filter === 'unread' ? 'You are all caught up' : 'No notifications', filter === 'unread' ? 'There are no unread notifications.' : 'Deadline reminders, announcements and study alerts will show up here.', '');
  }

  $('#pills').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) { filter = b.dataset.filter; render(); }
  });
  $('#markAll').addEventListener('click', function () {
    var all = getData('notifications', []).map(function (n) { return n.studentId === user.id ? Object.assign({}, n, { read: true }) : n; });
    saveData('notifications', all);
    toast('All notifications marked as read.', 'success');
  });
  $('#clearAll').addEventListener('click', function () {
    var list = mine();
    if (!list.length) return;
    confirmDialog({ title: 'Delete all notifications?', message: 'Remove all ' + list.length + ' notifications? New ones will still appear when something needs your attention.', confirmText: 'Delete all' }).then(function (ok) {
      if (!ok) return;
      dismiss(list.map(function (n) { return n.refKey; }));
      deleteWhere('notifications', function (n) { return n.studentId === user.id; });
      toast('All notifications deleted.', 'success');
    });
  });
  $('#notifList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = btn.closest('.notif-item');
    var n = mine().find(function (x) { return x.id === row.dataset.id; });
    if (!n) return;
    if (btn.dataset.act === 'read') { updateData('notifications', n.id, { read: true }); }
    else if (btn.dataset.act === 'delete') {
      dismiss([n.refKey]);
      deleteData('notifications', n.id);
      toast('Notification deleted.', 'success');
    } else if (btn.dataset.act === 'open') {
      if (!n.read) updateData('notifications', n.id, { read: true });
      if (n.link) navigate(n.link);
    }
  });

  render();
  onDataChange(render);
})();

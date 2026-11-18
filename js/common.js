/* ==========================================================================
   common.js — shared UI toolkit: app shell, modals, toasts, forms, helpers,
   notifications engine, charts and CSV export
   ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var TASK_CATEGORIES = ['Assignment', 'Project', 'Exam Preparation', 'Lab Work', 'Reading', 'Presentation', 'Personal', 'Other'];
  var PRIORITIES = ['Low', 'Medium', 'High'];
  var TASK_STATUSES = ['Pending', 'In Progress', 'Completed'];
  var DEFAULT_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Data Structures', 'Database Systems', 'Operating Systems',
    'Computer Networks', 'Machine Learning', 'Web Development', 'English', 'Economics'];
  var CHART_COLORS = ['#6366f1', '#8b5cf6', '#60a5fa', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- text / date helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toDate(v) {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return parseDate(v);
    var d = new Date(v);
    return isNaN(d) ? null : d;
  }
  function fmtDate(v) {
    var d = toDate(v);
    return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '—';
  }
  function fmtDateLong(d) {
    return (d || new Date()).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtTime(hhmm) {
    if (!hhmm) return '';
    var p = hhmm.split(':').map(Number), h = p[0], m = p[1];
    return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function timeAgo(iso) {
    var d = toDate(iso);
    if (!d) return '';
    var s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' hr' + (h > 1 ? 's' : '') + ' ago';
    var dd = Math.floor(h / 24);
    if (dd < 30) return dd + ' day' + (dd > 1 ? 's' : '') + ' ago';
    return fmtDate(iso);
  }
  function daysUntil(dateStr) {
    return Math.round((parseDate(dateStr) - parseDate(todayStr())) / 86400000);
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  function startOfWeek(dateStr) {
    var d = parseDate(dateStr || todayStr());
    var diff = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - diff);
    return toDateStr(d);
  }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function avatarHtml(user, cls) {
    var hues = [260, 220, 280, 200, 320, 170, 240];
    var h = 0, n = String(user && user.name || '?');
    for (var i = 0; i < n.length; i++) h = (h + n.charCodeAt(i)) % hues.length;
    var src = user && typeof user.avatar === 'string' && /^data:image\//.test(user.avatar) ? user.avatar : '';
    if (src) return '<span class="avatar ' + (cls || '') + '"><img src="' + esc(src) + '" alt=""></span>';
    return '<span class="avatar ' + (cls || '') + '" style="background:linear-gradient(135deg,hsl(' + hues[h] + ',70%,45%),hsl(' + (hues[h] + 40) + ',80%,62%))">' + esc(initials(n)) + '</span>';
  }

  /* ---------- data helpers ---------- */
  function ownRecords(key, userId) { return getData(key, []).filter(function (r) { return r.studentId === userId; }); }
  function studentById(id) { return getData('students', []).find(function (s) { return s.id === id; }) || null; }
  function studentName(id) { var s = studentById(id); return s ? s.name : 'Deleted student'; }
  function taskIsOverdue(t) { return t.status !== 'Completed' && !!t.dueDate && t.dueDate < todayStr(); }
  function asgIsOverdue(a) { return a.status !== 'Submitted' && !!a.deadline && a.deadline < todayStr(); }
  function taskDisplayStatus(t) { return taskIsOverdue(t) ? 'Overdue' : t.status; }
  function asgDisplayStatus(a) { return asgIsOverdue(a) ? 'Overdue' : a.status; }
  function taskStats(tasks) {
    var s = { total: tasks.length, completed: 0, open: 0, pending: 0, inProgress: 0, overdue: 0, upcoming: 0 };
    tasks.forEach(function (t) {
      if (t.status === 'Completed') { s.completed++; return; }
      s.open++;
      if (t.status === 'In Progress') s.inProgress++; else s.pending++;
      if (taskIsOverdue(t)) s.overdue++;
      else if (daysUntil(t.dueDate) <= 7) s.upcoming++;
    });
    s.rate = s.total ? Math.round(s.completed / s.total * 100) : 0;
    return s;
  }
  function asgStats(list) {
    var s = { total: list.length, submitted: 0, pending: 0, overdue: 0, notStarted: 0, inProgress: 0 };
    list.forEach(function (a) {
      if (a.status === 'Submitted') { s.submitted++; return; }
      if (a.status === 'Not Started') s.notStarted++; else s.inProgress++;
      if (asgIsOverdue(a)) s.overdue++; else s.pending++;
    });
    s.rate = s.total ? Math.round(s.submitted / s.total * 100) : 0;
    return s;
  }
  function dueInfo(dateStr, done) {
    if (!dateStr) return { text: 'No due date', cls: '' };
    if (done) return { text: 'Due ' + fmtDate(dateStr), cls: '' };
    var d = daysUntil(dateStr);
    if (d < 0) return { text: 'Overdue by ' + plural(-d, 'day'), cls: 'warn' };
    if (d === 0) return { text: 'Due today', cls: 'soon' };
    if (d === 1) return { text: 'Due tomorrow', cls: 'soon' };
    if (d <= 3) return { text: 'Due in ' + d + ' days', cls: 'soon' };
    return { text: 'Due in ' + d + ' days', cls: '' };
  }
  function annVisibleTo(a, student) {
    if (!a || a.status !== 'Published' || a.publishDate > todayStr()) return false;
    if (a.audience === 'all') return true;
    if (a.audience === 'department') return a.department === student.department;
    if (a.audience === 'semester') return Number(a.semester) === Number(student.semester);
    return false;
  }
  function subjectOptions(userId) {
    var set = {};
    DEFAULT_SUBJECTS.forEach(function (s) { set[s] = 1; });
    ['tasks', 'assignments', 'studySessions', 'notes'].forEach(function (k) {
      ownRecords(k, userId).forEach(function (r) { if (r.subject) set[r.subject] = 1; });
    });
    return Object.keys(set).sort();
  }
  function userActivityLabel(log) {
    if (log.role === 'admin') return 'Admin';
    return studentName(log.userId);
  }

  /* ---------- badges ---------- */
  function priorityBadge(p) {
    var c = { High: 'b-high', Medium: 'b-medium', Low: 'b-low' }[p] || 'b-gray';
    return '<span class="badge ' + c + '"><i class="fa-solid fa-flag"></i>' + esc(p || '—') + '</span>';
  }
  function statusBadge(s) {
    var map = {
      'Pending': 'b-pending', 'In Progress': 'b-progress', 'Completed': 'b-completed', 'Overdue': 'b-overdue',
      'Submitted': 'b-completed', 'Not Started': 'b-pending', 'Planned': 'b-pending', 'Skipped': 'b-danger',
      'Draft': 'b-gray', 'Published': 'b-success', 'Scheduled': 'b-purple', 'active': 'b-success', 'inactive': 'b-gray'
    };
    var label = s === 'active' ? 'Active' : s === 'inactive' ? 'Inactive' : s;
    return '<span class="badge ' + (map[s] || 'b-gray') + '">' + esc(label) + '</span>';
  }

  /* ---------- toasts ---------- */
  function toast(message, type, title) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; document.body.appendChild(c); }
    var icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    var titles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Notice' };
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = '<i class="fa-solid ' + icons[type] + '"></i><div><b>' + esc(title || titles[type]) + '</b><span>' + esc(message) + '</span></div>';
    c.appendChild(el);
    var gone = false;
    function dismiss() {
      if (gone) return; gone = true;
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 300);
    }
    el.addEventListener('click', dismiss);
    setTimeout(dismiss, type === 'error' ? 5200 : 3600);
  }
  function showFlash() {
    try {
      var raw = sessionStorage.getItem('stp_flash');
      if (!raw) return;
      sessionStorage.removeItem('stp_flash');
      var f = JSON.parse(raw);
      if (f && f.msg) toast(f.msg, f.type || 'info');
    } catch (e) { /* ignore */ }
  }

  /* ---------- forms ---------- */
  function fld(o) {
    var id = 'f_' + o.name, req = o.required ? ' required' : '';
    var v = o.value == null ? '' : o.value;
    var input;
    if (o.type === 'textarea') {
      input = '<textarea id="' + id + '" name="' + o.name + '" rows="' + (o.rows || 3) + '" placeholder="' + esc(o.placeholder || '') + '"' + req + ' ' + (o.attrs || '') + '>' + esc(v) + '</textarea>';
    } else if (o.type === 'select') {
      input = '<select id="' + id + '" name="' + o.name + '"' + req + ' ' + (o.attrs || '') + '>' + (o.options || []).map(function (op) {
        var val = typeof op === 'object' ? op.value : op, lab = typeof op === 'object' ? op.label : op;
        return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') + '</select>';
    } else {
      input = '<input id="' + id + '" type="' + (o.type || 'text') + '" name="' + o.name + '" value="' + esc(v) + '" placeholder="' + esc(o.placeholder || '') + '"' + req + ' ' + (o.attrs || '') + '>';
    }
    return '<div class="field' + (o.full ? ' full' : '') + '"><label for="' + id + '">' + esc(o.label) + (o.required ? '<span class="req">*</span>' : '') + '</label>' + input +
      '<small class="field-error" data-for="' + o.name + '"></small>' + (o.hint ? '<small class="field-hint">' + esc(o.hint) + '</small>' : '') + '</div>';
  }
  function getFormData(form) {
    var out = {};
    new FormData(form).forEach(function (v, k) { out[k] = typeof v === 'string' ? v.trim() : v; });
    return out;
  }
  function clearFieldErrors(form) {
    $$('.field-error', form).forEach(function (e) { e.textContent = ''; });
    $$('.invalid', form).forEach(function (e) { e.classList.remove('invalid'); });
  }
  function showFieldErrors(form, errors) {
    clearFieldErrors(form);
    var first = null;
    Object.keys(errors).forEach(function (k) {
      if (k === '_form') { toast(errors[k], 'error'); return; }
      var msg = $('.field-error[data-for="' + k + '"]', form);
      var input = form.elements[k];
      if (msg) msg.textContent = errors[k];
      if (input && input.classList) { input.classList.add('invalid'); if (!first) first = input; }
    });
    if (first && first.focus) first.focus();
  }

  /* ---------- modals ---------- */
  var openModals = [];
  function openModal(o) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var actions = o.actions || (o.hideFooter ? [] : [{ label: o.submitText || 'Save', value: 'save', cls: 'btn-primary' }]);
    var cancel = o.cancelText === false ? '' : '<button type="button" class="btn btn-secondary" data-close>' + esc(o.cancelText || (actions.length ? 'Cancel' : 'Close')) + '</button>';
    overlay.innerHTML =
      '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
      '<div class="modal-header"><h3>' + esc(o.title) + '</h3><button type="button" class="icon-btn sm" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<form class="modal-form" novalidate><div class="modal-body">' + o.content + '</div>' +
      '<div class="modal-footer">' + cancel + actions.map(function (a) {
        return '<button type="submit" class="btn ' + (a.cls || 'btn-primary') + '" data-action="' + esc(a.value) + '">' + a.label + '</button>';
      }).join('') + '</div></form></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    var form = $('form', overlay);
    var closed = false;
    var api = {
      el: overlay, form: form,
      close: function () {
        if (closed) return; closed = true;
        overlay.classList.add('closing');
        openModals = openModals.filter(function (m) { return m !== api; });
        if (!openModals.length) document.body.style.overflow = '';
        setTimeout(function () { overlay.remove(); }, 170);
        if (o.onClose) o.onClose();
      }
    };
    openModals.push(api);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) api.close(); });
    $$('[data-close]', overlay).forEach(function (b) { b.addEventListener('click', api.close); });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('invalid')) {
        t.classList.remove('invalid');
        var m = $('.field-error[data-for="' + t.name + '"]', form);
        if (m) m.textContent = '';
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFieldErrors(form);
      var action = e.submitter && e.submitter.dataset ? e.submitter.dataset.action : 'save';
      if (o.onSubmit) o.onSubmit(getFormData(form), api, action, form);
    });
    if (o.onOpen) o.onOpen(api);
    var firstInput = $('input:not([type=hidden]):not([type=range]), select, textarea', form);
    if (firstInput && !o.noFocus) setTimeout(function () { firstInput.focus(); }, 60);
    return api;
  }
  function closeModal() { var m = openModals[openModals.length - 1]; if (m) m.close(); }
  function confirmDialog(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var done = false;
      var danger = o.danger !== false;
      openModal({
        title: o.title || 'Are you sure?', size: 'sm',
        content: '<div class="confirm"><div class="confirm-icon ' + (danger ? 'danger' : '') + '"><i class="fa-solid ' + (o.icon || (danger ? 'fa-trash-can' : 'fa-circle-question')) + '"></i></div><p>' + (o.message || '') + '</p></div>',
        actions: [{ label: o.confirmText || 'Delete', value: 'ok', cls: danger ? 'btn-danger' : 'btn-primary' }],
        noFocus: true,
        onSubmit: function (d, api) { done = true; api.close(); resolve(true); },
        onClose: function () { if (!done) resolve(false); }
      });
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (openModals.length) closeModal();
      else $$('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    }
  });

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    var icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
    $$('.theme-icon').forEach(function (i) { i.className = 'fa-solid theme-icon ' + icon; });
    $$('.theme-label').forEach(function (l) { l.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode'; });
    $$('input[data-theme-switch]').forEach(function (i) { i.checked = theme === 'dark'; });
  }
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function setTheme(theme) {
    var u = getCurrentUser();
    if (u) setPrefs(u.id, { theme: theme });
    applyTheme(theme);
    global.dispatchEvent(new CustomEvent('stp:theme'));
  }
  function toggleTheme() { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }

  /* ---------- notifications engine (students) ---------- */
  var NOTE_STYLE = {
    deadline: { icon: 'fa-clock', cls: 'ic-amber' },
    overdue: { icon: 'fa-triangle-exclamation', cls: 'ic-red' },
    announcement: { icon: 'fa-bullhorn', cls: 'ic-purple' },
    study: { icon: 'fa-book-open-reader', cls: 'ic-blue' }
  };
  function generateNotifications(user) {
    var prefs = getPrefs(user.id);
    var dismissed = {};
    prefs.dismissed.forEach(function (k) { dismissed[k] = 1; });
    var all = getData('notifications', []);
    var mine = all.filter(function (n) { return n.studentId === user.id; });
    var have = {};
    mine.forEach(function (n) { have[n.refKey] = 1; });
    var today = todayStr();
    var created = [];

    function add(refKey, type, title, message, link) {
      if (have[refKey] || dismissed[refKey]) return;
      have[refKey] = 1;
      created.push({ id: generateUniqueId('ntf'), studentId: user.id, type: type, title: title, message: message, link: link, refKey: refKey, read: false, createdAt: new Date().toISOString() });
    }
    var tasks = ownRecords('tasks', user.id), asgs = ownRecords('assignments', user.id), sessions = ownRecords('studySessions', user.id);
    var anns = getData('announcements', []);
    var valid = {}; // refKeys that should still exist

    tasks.forEach(function (t) {
      if (t.status === 'Completed' || !t.dueDate) return;
      var d = daysUntil(t.dueDate);
      if (d < 0) {
        valid['overdue:' + t.id] = 1;
        if (prefs.notifications.overdue) add('overdue:' + t.id, 'overdue', 'Task overdue', '"' + t.title + '" was due on ' + fmtDate(t.dueDate) + '.', 'tasks.html?view=' + t.id);
      } else if (d <= 2) {
        valid['due:' + t.id + ':' + t.dueDate] = 1;
        if (prefs.notifications.deadlines) add('due:' + t.id + ':' + t.dueDate, 'deadline', d === 0 ? 'Task due today' : d === 1 ? 'Task due tomorrow' : 'Task due in 2 days', '"' + t.title + '" (' + t.subject + ') is due ' + (d === 0 ? 'today' : fmtDate(t.dueDate)) + '.', 'tasks.html?view=' + t.id);
      }
    });
    asgs.forEach(function (a) {
      if (a.status === 'Submitted' || !a.deadline) return;
      var d = daysUntil(a.deadline);
      if (d < 0) {
        valid['aoverdue:' + a.id] = 1;
        if (prefs.notifications.overdue) add('aoverdue:' + a.id, 'overdue', 'Assignment overdue', '"' + a.title + '" was due on ' + fmtDate(a.deadline) + '.', 'assignments.html');
      } else if (d <= 2) {
        valid['adue:' + a.id + ':' + a.deadline] = 1;
        if (prefs.notifications.deadlines) add('adue:' + a.id + ':' + a.deadline, 'deadline', d === 0 ? 'Assignment due today' : 'Assignment due soon', '"' + a.title + '" (' + a.subject + ') is due ' + (d === 0 ? 'today' : fmtDate(a.deadline)) + '.', 'assignments.html');
      }
    });
    anns.forEach(function (a) {
      if (!annVisibleTo(a, user)) return;
      valid['ann:' + a.id] = 1;
      if (prefs.notifications.announcements && daysUntil(a.publishDate) >= -30) add('ann:' + a.id, 'announcement', 'New announcement', a.title, 'announcements.html');
    });
    sessions.forEach(function (s) {
      if (s.status === 'Completed' || s.status === 'Skipped') return;
      var d = daysUntil(s.date);
      if (d === 0 || d === 1) {
        valid['study:' + s.id + ':' + s.date] = 1;
        if (prefs.notifications.study) add('study:' + s.id + ':' + s.date, 'study', 'Upcoming study session', s.subject + ' at ' + fmtTime(s.startTime) + (d === 0 ? ' today' : ' tomorrow') + '.', 'study-planner.html');
      }
    });

    // remove notifications whose source record was deleted / completed / changed
    var keep = all.filter(function (n) {
      if (n.studentId !== user.id) return true;
      return !!valid[n.refKey];
    });
    var changed = keep.length !== all.length || created.length > 0;
    if (changed) saveData('notifications', keep.concat(created));
  }
  function notifIcon(n) { return NOTE_STYLE[n.type] || { icon: 'fa-bell', cls: 'ic-purple' }; }

  /* ---------- app shell ---------- */
  var NAV = {
    student: [
      ['Main', [['dashboard', 'Dashboard', 'fa-chart-pie'], ['tasks', 'My Tasks', 'fa-list-check'], ['calendar', 'Calendar', 'fa-calendar-days']]],
      ['Planning', [['study-planner', 'Study Planner', 'fa-book-open-reader'], ['assignments', 'Assignments', 'fa-file-pen'], ['todo', 'To-Do List', 'fa-square-check'], ['notes', 'Notes', 'fa-note-sticky']]],
      ['Updates', [['announcements', 'Announcements', 'fa-bullhorn'], ['notifications', 'Notifications', 'fa-bell', 'notif']]],
      ['Account', [['profile', 'Profile & Settings', 'fa-user-gear']]]
    ],
    admin: [
      ['Overview', [['dashboard', 'Dashboard', 'fa-gauge-high']]],
      ['Management', [['students', 'Manage Students', 'fa-user-graduate'], ['tasks', 'Manage Tasks', 'fa-list-check'], ['assignments', 'Assignments', 'fa-file-lines'], ['announcements', 'Announcements', 'fa-bullhorn']]],
      ['Insights', [['reports', 'Reports & Analytics', 'fa-chart-line']]],
      ['Account', [['profile', 'Admin Profile', 'fa-user-shield']]]
    ]
  };

  function renderSidebar(user) {
    var role = user.role, page = document.body.dataset.page;
    var html = '<div class="sidebar-brand"><div class="brand-logo"><i class="fa-solid fa-graduation-cap"></i></div><div>Task Planner<small>' + (role === 'admin' ? 'Admin Console' : 'Student Portal') + '</small></div></div><nav class="sidebar-nav" aria-label="Main navigation">';
    NAV[role].forEach(function (group) {
      html += '<div class="nav-label">' + group[0] + '</div>';
      group[1].forEach(function (it) {
        html += '<a class="nav-link' + (it[0] === page ? ' active' : '') + '" href="' + it[0] + '.html"' + (it[0] === page ? ' aria-current="page"' : '') + '><i class="fa-solid ' + it[2] + '"></i><span>' + it[1] + '</span>' + (it[3] ? '<span class="nav-badge hidden" id="navNotifBadge">0</span>' : '') + '</a>';
      });
    });
    html += '</nav><div class="sidebar-footer"><div class="user-card" id="sidebarUser"></div><button class="sidebar-logout" id="logoutBtn" type="button"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log out</button></div>';
    $('#sidebar').innerHTML = html;
  }

  function renderTopbar(user) {
    var title = document.body.dataset.title || 'Dashboard';
    var sub = document.body.dataset.sub || fmtDateLong();
    $('#topbar').innerHTML =
      '<button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open navigation"><i class="fa-solid fa-bars"></i></button>' +
      '<div class="topbar-title"><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div>' +
      '<div class="topbar-actions">' +
      '<button class="icon-btn" id="themeBtn" type="button" title="Toggle dark mode" aria-label="Toggle dark mode"><i class="fa-solid fa-moon theme-icon"></i></button>' +
      '<div class="dropdown" id="notifDD"><button class="icon-btn" type="button" data-dd aria-label="' + (user.role === 'admin' ? 'Recent activity' : 'Notifications') + '"><i class="fa-solid fa-bell"></i><span class="dot-badge hidden" id="bellCount">0</span></button><div class="dropdown-menu wide" id="notifMenu"></div></div>' +
      '<div class="dropdown" id="profileDD"><button class="profile-btn" type="button" data-dd aria-label="Profile menu"><span id="pbAvatar"></span><span class="pb-name" id="pbName"></span><i class="fa-solid fa-chevron-down small"></i></button>' +
      '<div class="dropdown-menu" id="profileMenu"></div></div></div>';
  }

  function refreshShell() {
    var user = getCurrentUser();
    if (!user) return;
    var role = user.role;
    var first = String(user.name || '').split(' ')[0];
    var su = $('#sidebarUser');
    if (su) su.innerHTML = avatarHtml(user, 'md') + '<div class="uc-info"><div class="uc-name">' + esc(user.name) + '</div><div class="uc-role">' + (role === 'admin' ? 'Administrator' : esc(user.rollNo || 'Student')) + '</div></div>';
    var pa = $('#pbAvatar'); if (pa) pa.innerHTML = avatarHtml(user, 'sm');
    var pn = $('#pbName'); if (pn) pn.textContent = first;
    var pm = $('#profileMenu');
    if (pm) {
      pm.innerHTML = '<div class="dd-head" style="padding-bottom:4px"><span class="truncate">' + esc(user.name) + '</span></div><div class="muted small" style="padding:0 12px 8px">' + esc(user.email || '') + '</div><div class="dd-sep"></div>' +
        '<a class="dd-item" href="profile.html"><i class="fa-solid fa-user"></i> ' + (role === 'admin' ? 'Admin profile' : 'Profile & settings') + '</a>' +
        '<button class="dd-item" type="button" id="themeBtn2"><i class="fa-solid fa-moon theme-icon"></i> <span class="theme-label">Dark mode</span></button><div class="dd-sep"></div>' +
        '<button class="dd-item" type="button" id="logoutBtn2"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log out</button>';
      applyTheme(currentTheme());
    }
    var menu = $('#notifMenu'), bell = $('#bellCount');
    if (!menu) return;
    if (role === 'student') {
      var list = ownRecords('notifications', user.id).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      var unread = list.filter(function (n) { return !n.read; }).length;
      var nb = $('#navNotifBadge');
      [bell, nb].forEach(function (b) { if (!b) return; b.textContent = unread > 99 ? '99+' : unread; b.classList.toggle('hidden', !unread); });
      menu.innerHTML = '<div class="dd-head"><span>Notifications</span>' + (unread ? '<button type="button" id="ddMarkAll">Mark all read</button>' : '') + '</div><div class="dd-list">' +
        (list.length ? list.slice(0, 6).map(function (n) {
          var st = notifIcon(n);
          return '<div class="dd-note' + (n.read ? '' : ' unread') + '" data-nid="' + esc(n.id) + '" data-link="' + esc(n.link || 'notifications.html') + '"><div class="n-ic ' + st.cls + '"><i class="fa-solid ' + st.icon + '"></i></div><div><b>' + esc(n.title) + '</b><span>' + esc(n.message) + '</span><span>' + timeAgo(n.createdAt) + '</span></div></div>';
        }).join('') : '<div class="empty compact"><div class="empty-ic"><i class="fa-regular fa-bell"></i></div><h4>All caught up</h4><span class="small">No notifications yet.</span></div>') +
        '</div><div class="dd-sep"></div><a class="dd-item" href="notifications.html"><i class="fa-solid fa-list"></i> View all notifications</a>';
    } else {
      var since = Date.now() - 86400000;
      var logs = getData('activityLogs', []).filter(function (l) { return l.action !== 'Logged in'; }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      var recent = logs.filter(function (l) { return new Date(l.createdAt).getTime() >= since; }).length;
      if (bell) { bell.textContent = recent > 99 ? '99+' : recent; bell.classList.toggle('hidden', !recent); }
      menu.innerHTML = '<div class="dd-head"><span>Recent activity</span><span class="muted small">last 24h: ' + recent + '</span></div><div class="dd-list">' +
        (logs.length ? logs.slice(0, 6).map(function (l) {
          return '<div class="dd-note"><div class="n-ic ic-purple"><i class="fa-solid fa-bolt"></i></div><div><b>' + esc(l.action) + '</b><span>' + esc(userActivityLabel(l)) + (l.detail ? ' · ' + esc(l.detail) : '') + '</span><span>' + timeAgo(l.createdAt) + '</span></div></div>';
        }).join('') : '<div class="empty compact"><div class="empty-ic"><i class="fa-solid fa-bolt"></i></div><h4>No activity yet</h4></div>') +
        '</div><div class="dd-sep"></div><a class="dd-item" href="reports.html"><i class="fa-solid fa-chart-line"></i> Open reports</a>';
    }
  }

  function bindShellEvents(user) {
    document.addEventListener('click', function (e) {
      var dd = e.target.closest && e.target.closest('[data-dd]');
      if (dd) {
        var wrap = dd.closest('.dropdown');
        var wasOpen = wrap.classList.contains('open');
        $$('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
        if (!wasOpen) wrap.classList.add('open');
        return;
      }
      if (!(e.target.closest && e.target.closest('.dropdown-menu'))) $$('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('#themeBtn') || t.closest('#themeBtn2')) { toggleTheme(); return; }
      if (t.closest('#logoutBtn') || t.closest('#logoutBtn2')) { logout(); return; }
      if (t.closest('#ddMarkAll')) {
        var all = getData('notifications', []).map(function (n) { return n.studentId === user.id ? Object.assign({}, n, { read: true }) : n; });
        saveData('notifications', all);
        return;
      }
      var note = t.closest('.dd-note[data-nid]');
      if (note) {
        updateData('notifications', note.dataset.nid, { read: true });
        navigate(note.dataset.link);
      }
    });
    var sb = $('#sidebar'), ov = $('#sidebarOverlay');
    function setSidebar(open) { sb.classList.toggle('open', open); if (ov) ov.classList.toggle('show', open); }
    document.addEventListener('click', function (e) {
      if (e.target.closest('#menuBtn')) setSidebar(true);
      else if (e.target === ov || e.target.closest('#sidebar .nav-link')) setSidebar(false);
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1024) setSidebar(false); });
    // smooth page transition for in-app links
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
      e.preventDefault();
      navigate(href);
    });
  }
  function navigate(href) {
    document.body.classList.add('leaving');
    setTimeout(function () { global.location.href = href; }, 170);
  }

  function initShell() {
    var role = document.body.dataset.role;
    var user = global.requireRole(role);
    if (!user) return null;
    applyTheme(getPrefs(user.id).theme);
    if (role === 'student') generateNotifications(user);
    document.title = (document.body.dataset.title || 'Dashboard') + ' · Student Task Planner';
    renderSidebar(user);
    renderTopbar(user);
    refreshShell();
    bindShellEvents(user);
    var ov = document.createElement('div');
    ov.className = 'sidebar-overlay'; ov.id = 'sidebarOverlay';
    $('#sidebar').after(ov);
    var content = $('#content');
    if (content) {
      var loader = document.createElement('div');
      loader.className = 'page-loader';
      loader.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
      content.appendChild(loader);
      setTimeout(function () { loader.classList.add('hide'); setTimeout(function () { loader.remove(); }, 400); }, 320);
    }
    document.body.classList.add('ready');
    showFlash();
    onDataChange(function () {
      // account removed or deactivated while signed in → bounce to login
      if (!getCurrentUser()) { global.requireRole(role); return; }
      if (role === 'student') generateNotifications(getCurrentUser());
      refreshShell();
    });
    return user;
  }

  /* Debounced listener for any data / theme change (including other tabs). */
  function onDataChange(cb) {
    var t;
    function h() { clearTimeout(t); t = setTimeout(cb, 40); }
    global.addEventListener('stp:change', h);
    global.addEventListener('storage', h);
    global.addEventListener('stp:theme', h);
  }

  /* ---------- empty state ---------- */
  function emptyState(icon, title, text, actionHtml, compact) {
    return '<div class="empty' + (compact ? ' compact' : '') + '"><div class="empty-ic"><i class="fa-solid ' + icon + '"></i></div><h4>' + esc(title) + '</h4><p>' + esc(text || '') + '</p>' + (actionHtml || '') + '</div>';
  }

  /* ---------- charts ---------- */
  var charts = {};
  function renderChart(id, cfg) {
    var cv = document.getElementById(id);
    if (!cv) return null;
    if (typeof Chart === 'undefined') {
      cv.parentElement.innerHTML = '<div class="chart-fallback"><div><i class="fa-solid fa-chart-column" style="font-size:28px;margin-bottom:8px"></i><p>Charts need the Chart.js library.<br>Please check your internet connection and reload.</p></div></div>';
      return null;
    }
    var cs = getComputedStyle(document.documentElement);
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = cs.getPropertyValue('--text-muted').trim() || '#6b7694';
    Chart.defaults.borderColor = cs.getPropertyValue('--border').trim() || '#e4e8f2';
    if (charts[id]) charts[id].destroy();
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false }, cfg.options || {});
    charts[id] = new Chart(cv, cfg);
    return charts[id];
  }
  function cardBg() { return getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff'; }
  /* Doughnut with a graceful "no data" ring when every value is zero. */
  function doughnutChart(id, labels, data, colors, cutout) {
    var sum = data.reduce(function (a, b) { return a + b; }, 0);
    var empty = sum === 0;
    return renderChart(id, {
      type: 'doughnut',
      data: { labels: empty ? ['No data yet'] : labels, datasets: [{ data: empty ? [1] : data, backgroundColor: empty ? ['#cfd5e6'] : colors, borderColor: cardBg(), borderWidth: 3, hoverOffset: 6 }] },
      options: { cutout: cutout || '66%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } }, tooltip: { enabled: !empty } } }
    });
  }
  /* Shared axis options: integer ticks, subtle grid. */
  function axisOpts(extra) {
    return Object.assign({ beginAtZero: true, ticks: { precision: 0 } }, extra || {});
  }

  /* ---------- CSV ---------- */
  function downloadCSV(filename, headers, rows) {
    function q(v) {
      var s = v == null ? '' : String(v);
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var csv = [headers].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  /* ---------- ripple on buttons ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.btn');
    if (!b) return;
    var r = b.getBoundingClientRect(), size = Math.max(r.width, r.height);
    var s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
    b.appendChild(s);
    setTimeout(function () { s.remove(); }, 600);
  });

  /* ---------- student task modal (shared by tasks, calendar, dashboard) ---------- */
  function openTaskModal(task, opts) {
    opts = opts || {};
    var user = getCurrentUser();
    if (!user || user.role !== 'student') return;
    if (task && task.studentId !== user.id) { toast('You can only edit your own tasks.', 'error'); return; }
    var def = opts.defaults || {}, t = task || {};
    var val = function (k, d) { return t[k] !== undefined ? t[k] : (def[k] !== undefined ? def[k] : d); };
    var isEdit = !!task;
    var content = '<datalist id="subjectList">' + subjectOptions(user.id).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist><div class="form-grid">' +
      fld({ label: 'Task title', name: 'title', required: true, full: true, value: val('title', ''), placeholder: 'e.g. Complete physics lab report', attrs: 'maxlength="120"' }) +
      fld({ label: 'Description', name: 'description', type: 'textarea', full: true, value: val('description', ''), placeholder: 'Add details, links or notes…', attrs: 'maxlength="1000"' }) +
      fld({ label: 'Subject', name: 'subject', required: true, value: val('subject', ''), attrs: 'list="subjectList" autocomplete="off" maxlength="60"', placeholder: 'Choose or type a subject' }) +
      fld({ label: 'Category', name: 'category', type: 'select', options: TASK_CATEGORIES, value: val('category', 'Assignment') }) +
      fld({ label: 'Priority', name: 'priority', type: 'select', options: PRIORITIES, value: val('priority', 'Medium') }) +
      fld({ label: 'Status', name: 'status', type: 'select', options: TASK_STATUSES, value: val('status', 'Pending') }) +
      fld({ label: 'Start date', name: 'startDate', type: 'date', value: val('startDate', todayStr()) }) +
      fld({ label: 'Due date', name: 'dueDate', type: 'date', required: true, value: val('dueDate', '') }) +
      fld({ label: 'Estimated time (hours)', name: 'estimatedHours', type: 'number', value: val('estimatedHours', ''), attrs: 'min="0" max="200" step="0.5"', placeholder: 'e.g. 2.5' }) +
      '</div>';
    openModal({
      title: isEdit ? 'Edit Task' : 'Add New Task', content: content, submitText: isEdit ? '<i class="fa-solid fa-check"></i> Save Changes' : '<i class="fa-solid fa-plus"></i> Add Task',
      onSubmit: function (d, api, action, form) {
        var errs = {};
        if (!d.title) errs.title = 'Task title is required.';
        else if (d.title.length < 3) errs.title = 'Title must be at least 3 characters.';
        if (!d.subject) errs.subject = 'Subject is required.';
        if (!d.dueDate) errs.dueDate = 'Due date is required.';
        else if (d.startDate && d.dueDate < d.startDate) errs.dueDate = 'Due date cannot be before the start date.';
        if (d.estimatedHours !== '' && (isNaN(Number(d.estimatedHours)) || Number(d.estimatedHours) < 0)) errs.estimatedHours = 'Enter a valid number of hours.';
        if (!errs.title && !errs.subject && !errs.dueDate) {
          var dup = ownRecords('tasks', user.id).some(function (x) {
            return x.id !== t.id && x.title.toLowerCase() === d.title.toLowerCase() && x.subject.toLowerCase() === d.subject.toLowerCase() && x.dueDate === d.dueDate;
          });
          if (dup) errs.title = 'A task with the same title, subject and due date already exists.';
        }
        if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
        var now = new Date().toISOString();
        var rec = {
          title: d.title, description: d.description, subject: d.subject, category: d.category, priority: d.priority,
          startDate: d.startDate || '', dueDate: d.dueDate, estimatedHours: d.estimatedHours === '' ? 0 : Number(d.estimatedHours), status: d.status,
          updatedAt: now, completedAt: d.status === 'Completed' ? (t.completedAt || now) : ''
        };
        var saved;
        if (isEdit) {
          saved = updateData('tasks', t.id, rec);
          if (saved) logActivity(user.id, 'student', 'Updated task', d.title);
        } else {
          saved = insertData('tasks', Object.assign(rec, { studentId: user.id }));
          if (saved) logActivity(user.id, 'student', 'Added task', d.title);
        }
        if (!saved) return;
        toast(isEdit ? 'Task updated successfully.' : 'Task added successfully.', 'success');
        api.close();
        if (opts.onSaved) opts.onSaved(saved);
      }
    });
  }

  Object.assign(global, {
    $: $, $$: $$, esc: esc, toDate: toDate, fmtDate: fmtDate, fmtDateLong: fmtDateLong, fmtTime: fmtTime, timeAgo: timeAgo,
    daysUntil: daysUntil, plural: plural, greeting: greeting, startOfWeek: startOfWeek, initials: initials, avatarHtml: avatarHtml,
    ownRecords: ownRecords, studentById: studentById, studentName: studentName, taskIsOverdue: taskIsOverdue, asgIsOverdue: asgIsOverdue,
    taskDisplayStatus: taskDisplayStatus, asgDisplayStatus: asgDisplayStatus, taskStats: taskStats, asgStats: asgStats, dueInfo: dueInfo,
    annVisibleTo: annVisibleTo, subjectOptions: subjectOptions, userActivityLabel: userActivityLabel,
    priorityBadge: priorityBadge, statusBadge: statusBadge, toast: toast, showFlash: showFlash,
    fld: fld, getFormData: getFormData, showFieldErrors: showFieldErrors, clearFieldErrors: clearFieldErrors,
    openModal: openModal, closeModal: closeModal, confirmDialog: confirmDialog,
    applyTheme: applyTheme, toggleTheme: toggleTheme, setTheme: setTheme, currentTheme: currentTheme,
    generateNotifications: generateNotifications, notifIcon: notifIcon, initShell: initShell, onDataChange: onDataChange, navigate: navigate,
    emptyState: emptyState, renderChart: renderChart, cardBg: cardBg, doughnutChart: doughnutChart, axisOpts: axisOpts, downloadCSV: downloadCSV, openTaskModal: openTaskModal,
    TASK_CATEGORIES: TASK_CATEGORIES, PRIORITIES: PRIORITIES, TASK_STATUSES: TASK_STATUSES, CHART_COLORS: CHART_COLORS, MONTHS: MONTHS
  });
})(window);

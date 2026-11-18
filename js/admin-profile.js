/* ==========================================================================
   admin-profile.js — admin profile, password and demo-data reset
   ========================================================================== */
(function () {
  'use strict';
  var admin = initShell();
  if (!admin) return;

  function me() { return getCurrentUser() || admin; }

  function renderStatic() {
    var u = me();
    $('#avatarBox').innerHTML = avatarHtml(u, 'lg');
    $('#pName').textContent = u.name;
    $('#pEmail').textContent = u.email || '';
    $('#pUser').textContent = u.username;
    var published = getData('announcements', []).filter(function (a) { return a.status === 'Published'; }).length;
    $('#miniStats').innerHTML = '<div><b>' + getData('students', []).length + '</b><span>Students</span></div><div><b>' + getData('tasks', []).length + '</b><span>Tasks</span></div><div><b>' + published + '</b><span>Announcements</span></div>';
  }

  function renderForms() {
    var u = me();
    $('#profileFields').innerHTML =
      fld({ label: 'Full name', name: 'name', required: true, value: u.name, attrs: 'maxlength="60"' }) +
      fld({ label: 'Username', name: 'username', value: u.username, attrs: 'disabled', hint: 'The admin username cannot be changed.' }) +
      fld({ label: 'Email', name: 'email', type: 'email', value: u.email || '', full: true });
    $('#pwFields').innerHTML =
      fld({ label: 'Current password', name: 'current', type: 'password', required: true, full: true, attrs: 'autocomplete="current-password"' }) +
      fld({ label: 'New password', name: 'next', type: 'password', required: true, attrs: 'autocomplete="new-password"', hint: '8+ characters with upper, lower case and a number.' }) +
      fld({ label: 'Confirm new password', name: 'confirm', type: 'password', required: true, attrs: 'autocomplete="new-password"' });
    applyTheme(getPrefs(admin.id).theme);
  }

  $('#profileForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, d = getFormData(form), errs = {};
    var name = String(d.name || '').replace(/\s+/g, ' ');
    if (!name) errs.name = 'Name is required.'; else if (name.length < 2) errs.name = 'Name must be at least 2 characters.';
    if (d.email && !Auth.EMAIL_RE.test(d.email)) errs.email = 'Enter a valid email address.';
    if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
    var rec = Object.assign({}, getData('admin', {}), { name: name, email: d.email });
    if (saveData('admin', rec)) {
      logActivity(admin.id, 'admin', 'Updated admin profile', '');
      toast('Profile updated successfully.', 'success');
      renderStatic();
    }
  });

  $('#pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, d = getFormData(form);
    var res = Auth.changePassword(d.current, d.next, d.confirm);
    if (!res.ok) { showFieldErrors(form, res.errors); toast('Password was not changed.', 'error'); return; }
    clearFieldErrors(form);
    form.reset();
    toast('Password updated successfully.', 'success');
  });

  $('#swTheme').addEventListener('change', function (e) { setTheme(e.target.checked ? 'dark' : 'light'); });
  $('#logoutBtn3').addEventListener('click', function () { logout(); });

  $('#resetBtn').addEventListener('click', function () {
    confirmDialog({
      title: 'Reset all demo data?',
      message: 'This permanently erases <b>every student, task, assignment, study session, note, to-do and announcement</b> (including accounts students registered) and restores the original demo data. Your admin session stays active.',
      confirmText: 'Yes, reset everything', icon: 'fa-rotate-left'
    }).then(function (ok) {
      if (!ok) return;
      resetDemoData();
      Auth.setFlash('success', 'Demo data has been reset to its defaults.');
      setTimeout(function () { location.reload(); }, 150);
    });
  });

  renderStatic();
  renderForms();
  onDataChange(renderStatic);
})();

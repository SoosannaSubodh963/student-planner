/* ==========================================================================
   student-profile.js — profile, password, photo, theme and notification prefs
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;

  function me() { return getCurrentUser() || user; }

  function renderStatic() {
    var u = me();
    $('#avatarBox').innerHTML = avatarHtml(u, 'lg') + '<button class="cam" type="button" id="camBtn" aria-label="Change profile photo"><i class="fa-solid fa-camera"></i></button>';
    $('#pName').textContent = u.name;
    $('#pEmail').textContent = u.email;
    $('#pChips').innerHTML = '<span class="chip"><i class="fa-solid fa-id-badge"></i>' + esc(u.rollNo) + '</span><span class="chip"><i class="fa-solid fa-building-columns"></i>' + esc(u.department) + '</span><span class="chip"><i class="fa-solid fa-layer-group"></i>Semester ' + esc(u.semester) + '</span>';
    var s = taskStats(ownRecords('tasks', u.id)), a = asgStats(ownRecords('assignments', u.id));
    $('#miniStats').innerHTML = '<div><b>' + s.total + '</b><span>Tasks</span></div><div><b>' + s.rate + '%</b><span>Completed</span></div><div><b>' + a.submitted + '/' + a.total + '</b><span>Submitted</span></div>';
    $('#removePhoto').classList.toggle('hidden', !u.avatar);
    $('#camBtn').addEventListener('click', function () { $('#photoInput').click(); });
  }

  function renderForms() {
    var u = me();
    $('#profileFields').innerHTML =
      fld({ label: 'Full name', name: 'name', required: true, value: u.name, attrs: 'maxlength="60" autocomplete="name"' }) +
      fld({ label: 'Student ID / Roll number', name: 'rollNo', value: u.rollNo, attrs: 'disabled', hint: 'The student ID can only be changed by an administrator.' }) +
      fld({ label: 'Email', name: 'email', type: 'email', required: true, value: u.email, attrs: 'autocomplete="email"', full: true }) +
      fld({ label: 'Department', name: 'department', type: 'select', required: true, value: u.department, options: STP.DEPARTMENTS }) +
      fld({ label: 'Semester', name: 'semester', type: 'select', required: true, value: u.semester, options: STP.SEMESTERS.map(function (s) { return { value: s, label: 'Semester ' + s }; }) });
    $('#pwFields').innerHTML =
      fld({ label: 'Current password', name: 'current', type: 'password', required: true, full: true, attrs: 'autocomplete="current-password"' }) +
      fld({ label: 'New password', name: 'next', type: 'password', required: true, attrs: 'autocomplete="new-password"', hint: '8+ characters with upper, lower case and a number.' }) +
      fld({ label: 'Confirm new password', name: 'confirm', type: 'password', required: true, attrs: 'autocomplete="new-password"' });
  }

  function loadPrefs() {
    var p = getPrefs(user.id);
    $$('input[data-pref]').forEach(function (i) { i.checked = !!p.notifications[i.dataset.pref]; });
    applyTheme(p.theme);
  }

  $('#profileForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = me(), form = e.target;
    var d = getFormData(form);
    var data = { name: d.name, rollNo: u.rollNo, email: d.email, department: d.department, semester: d.semester };
    var errs = Auth.validateStudentFields(data, { ignoreId: u.id });
    delete errs.rollNo;
    if (Object.keys(errs).length) { showFieldErrors(form, errs); toast('Please fix the highlighted fields.', 'error'); return; }
    var saved = updateData('students', u.id, { name: d.name.replace(/\s+/g, ' '), email: Auth.normEmail(d.email), department: d.department, semester: Number(d.semester) });
    if (saved) {
      logActivity(u.id, 'student', 'Updated profile', '');
      toast('Profile updated successfully.', 'success');
      renderStatic();
      generateNotifications(me());
    }
  });
  $('#profileForm').addEventListener('input', function (e) { e.target.classList.remove('invalid'); });

  $('#pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, d = getFormData(form);
    var res = Auth.changePassword(d.current, d.next, d.confirm);
    if (!res.ok) { showFieldErrors(form, res.errors); toast('Password was not changed.', 'error'); return; }
    clearFieldErrors(form);
    form.reset();
    toast('Password updated successfully.', 'success');
  });

  // profile photo: validate, downscale to 256px and store as a data URL
  $('#uploadBtn').addEventListener('click', function () { $('#photoInput').click(); });
  $('#photoInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { toast('Please choose a PNG, JPG, WEBP or GIF image.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Image is too large. Choose a file under 5 MB.', 'error'); return; }
    var reader = new FileReader();
    reader.onerror = function () { toast('Could not read that image.', 'error'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { toast('That file is not a valid image.', 'error'); };
      img.onload = function () {
        var size = 256, c = document.createElement('canvas');
        c.width = c.height = size;
        var side = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        if (updateData('students', user.id, { avatar: c.toDataURL('image/jpeg', 0.85) })) {
          logActivity(user.id, 'student', 'Updated profile photo', '');
          toast('Profile photo updated.', 'success');
          renderStatic();
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  $('#removePhoto').addEventListener('click', function () {
    updateData('students', user.id, { avatar: '' });
    toast('Profile photo removed.', 'success');
    renderStatic();
  });

  $('#swTheme').addEventListener('change', function (e) { setTheme(e.target.checked ? 'dark' : 'light'); });
  $$('input[data-pref]').forEach(function (i) {
    i.addEventListener('change', function () {
      var cur = getPrefs(user.id).notifications, patch = {};
      patch[i.dataset.pref] = i.checked;
      setPrefs(user.id, { notifications: Object.assign({}, cur, patch) });
      generateNotifications(me());
      toast('Notification preference saved.', 'success');
    });
  });
  $('#logoutBtn3').addEventListener('click', function () { logout(); });

  renderStatic();
  renderForms();
  loadPrefs();
  // keep stats/header fresh without wiping what the user is typing in the forms
  onDataChange(function () { renderStatic(); });
})();

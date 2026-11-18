/* ==========================================================================
   auth.js — registration, login, sessions and role-based access control
   (frontend demonstration only; LocalStorage auth is not secure)
   ========================================================================== */
(function (global) {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,59}$/;
  var ROLL_RE = /^[A-Za-z0-9][A-Za-z0-9\-_/]{2,19}$/;

  function normEmail(e) { return String(e || '').trim().toLowerCase(); }

  /* Returns an error message, or '' when the password is acceptable. */
  function passwordIssue(pw) {
    pw = String(pw || '');
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(pw)) return 'Password needs a lowercase letter.';
    if (!/[A-Z]/.test(pw)) return 'Password needs an uppercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password needs a number.';
    return '';
  }

  function passwordStrength(pw) {
    var s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    return pw ? Math.max(1, s) : 0;
  }

  function validateStudentFields(d, opts) {
    opts = opts || {};
    var errors = {};
    var name = String(d.name || '').trim();
    var roll = String(d.rollNo || '').trim();
    var email = normEmail(d.email);
    var students = getData('students', []);

    if (!name) errors.name = 'Full name is required.';
    else if (!NAME_RE.test(name)) errors.name = 'Use letters, spaces, dots, hyphens or apostrophes (2-60 characters).';

    if (!roll) errors.rollNo = 'Student ID / roll number is required.';
    else if (!ROLL_RE.test(roll)) errors.rollNo = 'Use 3-20 letters, numbers, dashes or slashes.';
    else if (students.some(function (s) { return s.rollNo.toLowerCase() === roll.toLowerCase() && s.id !== opts.ignoreId; })) errors.rollNo = 'This student ID is already registered.';

    if (!email) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
    else if (students.some(function (s) { return normEmail(s.email) === email && s.id !== opts.ignoreId; })) errors.email = 'This email is already registered.';

    if (!d.department) errors.department = 'Select your department.';
    else if (STP.DEPARTMENTS.indexOf(d.department) === -1) errors.department = 'Select a valid department.';

    var sem = Number(d.semester);
    if (!d.semester) errors.semester = 'Select your semester.';
    else if (!(sem >= 1 && sem <= 8)) errors.semester = 'Select a valid semester.';

    return errors;
  }

  function registerStudent(d) {
    var errors = validateStudentFields(d);
    var pwIssue = passwordIssue(d.password);
    if (pwIssue) errors.password = pwIssue;
    if (!d.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (d.password !== d.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errors).length) return { ok: false, errors: errors };

    var student = insertData('students', {
      id: generateUniqueId('stu'),
      rollNo: String(d.rollNo).trim(),
      name: String(d.name).trim().replace(/\s+/g, ' '),
      email: normEmail(d.email),
      passwordHash: hashPassword(d.password),
      department: d.department,
      semester: Number(d.semester),
      avatar: '',
      status: 'active'
    });
    if (!student) return { ok: false, errors: { _form: 'Could not save your account. Please try again.' } };
    logActivity(student.id, 'student', 'Registered', 'Created a student account');
    return { ok: true, student: student };
  }

  function loginStudent(email, password) {
    var e = normEmail(email);
    if (!e || !password) return { ok: false, error: 'Please enter your email and password.' };
    var st = getData('students', []).find(function (s) { return normEmail(s.email) === e; });
    if (!st || st.passwordHash !== hashPassword(password)) return { ok: false, error: 'Invalid email or password.' };
    if (st.status === 'inactive') return { ok: false, error: 'Your account has been deactivated. Please contact the administrator.' };
    setSession(st.id, 'student');
    logActivity(st.id, 'student', 'Logged in', '');
    return { ok: true, user: st };
  }

  function loginAdmin(username, password) {
    var u = String(username || '').trim().toLowerCase();
    if (!u || !password) return { ok: false, error: 'Please enter your username and password.' };
    var a = getData('admin', null);
    if (!a || String(a.username).toLowerCase() !== u || a.passwordHash !== hashPassword(password)) {
      return { ok: false, error: 'Invalid admin username or password.' };
    }
    setSession(a.id, 'admin');
    logActivity(a.id, 'admin', 'Logged in', '');
    return { ok: true, user: a };
  }

  function dashboardFor(role) { return (role === 'admin' ? 'admin/' : 'student/') + 'dashboard.html'; }

  function setFlash(type, msg) {
    try { sessionStorage.setItem('stp_flash', JSON.stringify({ type: type, msg: msg })); } catch (e) { /* ignore */ }
  }

  /* Route guard: call first on every dashboard page. Returns the user or null
     (after scheduling a redirect). */
  function requireRole(role) {
    var base = getBase();
    var user = getCurrentUser();
    if (!user) {
      var hadSession = !!getData('session', null);
      if (hadSession) localStorage.removeItem(STP.KEYS.session);
      setFlash('warning', hadSession ? 'Your session is no longer valid. Please log in again.' : 'Please log in to continue.');
      global.location.replace(base + 'login.html');
      return null;
    }
    if (user.role !== role) {
      setFlash('error', 'Access denied: that area is not available for your account type.');
      global.location.replace(base + dashboardFor(user.role));
      return null;
    }
    return user;
  }

  /* For login / register / landing: send signed-in users to their dashboard. */
  function redirectIfLoggedIn() {
    var user = getCurrentUser();
    if (user) { global.location.replace(getBase() + dashboardFor(user.role)); return true; }
    return false;
  }

  /* Change the password of the current user (student or admin). */
  function changePassword(current, next, confirm) {
    var user = getCurrentUser();
    var errors = {};
    if (!user) return { ok: false, errors: { _form: 'You are not logged in.' } };
    if (!current) errors.current = 'Enter your current password.';
    else if (user.passwordHash !== hashPassword(current)) errors.current = 'Current password is incorrect.';
    var issue = passwordIssue(next);
    if (issue) errors.next = issue;
    else if (current && next === current) errors.next = 'New password must be different from the current one.';
    if (!confirm) errors.confirm = 'Please confirm the new password.';
    else if (next !== confirm) errors.confirm = 'Passwords do not match.';
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    var key = user.role === 'admin' ? 'admin' : 'students';
    if (user.role === 'admin') saveData('admin', Object.assign({}, getData('admin', {}), { passwordHash: hashPassword(next) }));
    else updateData(key, user.id, { passwordHash: hashPassword(next) });
    logActivity(user.id, user.role, 'Changed password', '');
    return { ok: true };
  }

  global.Auth = {
    EMAIL_RE: EMAIL_RE, normEmail: normEmail, passwordIssue: passwordIssue, passwordStrength: passwordStrength,
    validateStudentFields: validateStudentFields, registerStudent: registerStudent, loginStudent: loginStudent,
    loginAdmin: loginAdmin, requireRole: requireRole, redirectIfLoggedIn: redirectIfLoggedIn,
    changePassword: changePassword, dashboardFor: dashboardFor, setFlash: setFlash
  };
  global.requireRole = requireRole;

  /* ======================================================================
     Page controllers for index.html, login.html and register.html
     ====================================================================== */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function bindPasswordToggles() {
    qsa('.pw-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentElement.querySelector('input');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = '<i class="fa-solid ' + (show ? 'fa-eye-slash' : 'fa-eye') + '"></i>';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  function initHome() {
    var user = getCurrentUser();
    var cta = qs('#navCta'), heroCta = qs('#heroCta'), band = qs('#bandCta');
    if (user) {
      var dash = dashboardFor(user.role);
      var btn = '<a class="btn btn-primary" href="' + dash + '"><i class="fa-solid fa-gauge-high"></i> Go to Dashboard</a>';
      if (cta) cta.innerHTML = btn;
      if (heroCta) heroCta.innerHTML = '<a class="btn btn-white btn-lg" href="' + dash + '"><i class="fa-solid fa-gauge-high"></i> Open my dashboard</a>';
      if (band) band.innerHTML = '<a class="btn btn-white btn-lg" href="' + dash + '">Open my dashboard</a>';
    }
    var counts = {
      students: getData('students', []).length,
      tasks: getData('tasks', []).length,
      assignments: getData('assignments', []).length
    };
    qsa('[data-count]').forEach(function (el) { el.textContent = counts[el.getAttribute('data-count')] || 0; });
  }

  function showAlert(el, msg) {
    el.textContent = msg;
    el.classList.add('show');
  }

  function initLogin() {
    if (redirectIfLoggedIn()) return;
    var tabs = qsa('.role-tab'), forms = { student: qs('#studentForm'), admin: qs('#adminForm') };
    function select(role) {
      tabs.forEach(function (t) { var on = t.dataset.role === role; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
      Object.keys(forms).forEach(function (k) { forms[k].classList.toggle('hidden', k !== role); });
      qsa('.form-alert').forEach(function (a) { a.classList.remove('show'); });
      qs('#title').textContent = role === 'admin' ? 'Admin sign in' : 'Welcome back';
      qs('#subtitle').textContent = role === 'admin' ? 'Sign in to manage students, tasks and announcements.' : 'Log in to continue planning your studies.';
      qs('#demoStudent').classList.toggle('hidden', role !== 'student');
      qs('#demoAdmin').classList.toggle('hidden', role !== 'admin');
      var first = forms[role].querySelector('input');
      if (first) first.focus();
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { select(t.dataset.role); }); });
    var wanted = new URLSearchParams(location.search).get('role');
    select(wanted === 'admin' ? 'admin' : 'student');
    bindPasswordToggles();
    showFlash();

    function finish(result, form, role) {
      var alert = qs('.form-alert', form);
      if (!result.ok) {
        showAlert(alert, result.error);
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        return;
      }
      alert.classList.remove('show');
      setFlash('success', 'Welcome back, ' + String(result.user.name).split(' ')[0] + '!');
      toast('Login successful. Redirecting…', 'success');
      setTimeout(function () { global.location.href = dashboardFor(role); }, 600);
    }
    forms.student.addEventListener('submit', function (e) {
      e.preventDefault();
      finish(loginStudent(forms.student.email.value, forms.student.password.value), forms.student, 'student');
    });
    forms.admin.addEventListener('submit', function (e) {
      e.preventDefault();
      finish(loginAdmin(forms.admin.username.value, forms.admin.password.value), forms.admin, 'admin');
    });
    qsa('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.fill === 'admin') { forms.admin.username.value = 'admin'; forms.admin.password.value = 'Admin@123'; }
        else { forms.student.email.value = b.dataset.email; forms.student.password.value = 'Student@123'; }
      });
    });
  }

  function initRegister() {
    if (redirectIfLoggedIn()) return;
    var form = qs('#registerForm');
    var dept = form.department, sem = form.semester;
    STP.DEPARTMENTS.forEach(function (d) { dept.insertAdjacentHTML('beforeend', '<option value="' + esc(d) + '">' + esc(d) + '</option>'); });
    STP.SEMESTERS.forEach(function (s) { sem.insertAdjacentHTML('beforeend', '<option value="' + s + '">Semester ' + s + '</option>'); });
    bindPasswordToggles();
    var meter = qs('#strength'), hint = qs('#strengthText');
    var labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    form.password.addEventListener('input', function () {
      var s = passwordStrength(form.password.value);
      meter.className = 'strength' + (s ? ' s' + s : '');
      hint.textContent = s ? 'Password strength: ' + labels[s] : 'Use 8+ characters with upper, lower case and a number.';
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('invalid')) {
        t.classList.remove('invalid');
        var m = qs('.field-error[data-for="' + t.name + '"]', form);
        if (m) m.textContent = '';
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      ['name', 'rollNo', 'email', 'password', 'confirmPassword', 'department', 'semester'].forEach(function (k) { data[k] = form.elements[k].value; });
      var res = registerStudent(data);
      if (!res.ok) {
        showFieldErrors(form, res.errors);
        toast('Please correct the highlighted fields.', 'error');
        return;
      }
      setFlash('success', 'Registration successful! You can now log in.');
      toast('Account created successfully! Redirecting to login…', 'success');
      form.querySelector('button[type=submit]').disabled = true;
      setTimeout(function () { global.location.href = 'login.html'; }, 1300);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page === 'home') initHome();
    else if (page === 'login') initLogin();
    else if (page === 'register') initRegister();
  });
})(window);

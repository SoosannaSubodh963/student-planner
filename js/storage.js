/* ==========================================================================
   storage.js — centralised LocalStorage database layer
   --------------------------------------------------------------------------
   Every module reads from and writes to LocalStorage through these helpers.
   No in-memory array is ever used as the source of truth.

   NOTE: LocalStorage authentication is a frontend demonstration only. Anyone
   can inspect or edit browser storage, so never use this approach (or store
   real passwords / personal data this way) in a production application.
   ========================================================================== */
(function (global) {
  'use strict';

  var KEYS = {
    students: 'stp_students',
    admin: 'stp_admin',
    tasks: 'stp_tasks',
    assignments: 'stp_assignments',
    studySessions: 'stp_study_sessions',
    todos: 'stp_todos',
    notes: 'stp_notes',
    announcements: 'stp_announcements',
    notifications: 'stp_notifications',
    activityLogs: 'stp_activity_logs',
    session: 'stp_session',
    settings: 'stp_settings'
  };

  var DEPARTMENTS = [
    'Computer Science',
    'Information Technology',
    'Electronics & Communication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Business Administration'
  ];
  var SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
  var ADMIN_ID = 'admin_1';

  function resolveKey(key) { return KEYS[key] || key; }

  /* ---------- date helpers (local time, YYYY-MM-DD strings) ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return toDateStr(new Date()); }
  function parseDate(s) {
    var p = String(s).slice(0, 10).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); }
  function isoDaysAgo(days, hour) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour == null ? 10 : hour, 0, 0, 0);
    return d.toISOString();
  }

  /* ---------- core CRUD ---------- */
  function getData(key, fallback) {
    var fb = fallback === undefined ? [] : fallback;
    try {
      var raw = localStorage.getItem(resolveKey(key));
      if (raw === null) return fb;
      var val = JSON.parse(raw);
      return val === null ? fb : val;
    } catch (e) {
      console.warn('[storage] Could not read "' + key + '":', e);
      return fb;
    }
  }

  function saveData(key, value) {
    var k = resolveKey(key);
    try {
      localStorage.setItem(k, JSON.stringify(value));
      global.dispatchEvent(new CustomEvent('stp:change', { detail: { key: k } }));
      return true;
    } catch (e) {
      console.error('[storage] Could not save "' + k + '":', e);
      if (typeof global.toast === 'function') global.toast('Browser storage is full or unavailable. Changes were not saved.', 'error');
      return false;
    }
  }

  function generateUniqueId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function insertData(key, item) {
    var list = getData(key, []);
    var record = Object.assign({ id: generateUniqueId(String(key).slice(0, 3)), createdAt: new Date().toISOString() }, item);
    list.push(record);
    return saveData(key, list) ? record : null;
  }

  function updateData(key, id, changes) {
    var list = getData(key, []);
    var idx = list.findIndex(function (r) { return r.id === id; });
    if (idx === -1) return null;
    var patch = typeof changes === 'function' ? changes(list[idx]) : changes;
    list[idx] = Object.assign({}, list[idx], patch);
    return saveData(key, list) ? list[idx] : null;
  }

  function deleteData(key, id) {
    var list = getData(key, []);
    var next = list.filter(function (r) { return r.id !== id; });
    if (next.length === list.length) return false;
    return saveData(key, next);
  }

  function deleteWhere(key, predicate) {
    var list = getData(key, []);
    var next = list.filter(function (r) { return !predicate(r); });
    if (next.length !== list.length) saveData(key, next);
    return list.length - next.length;
  }

  function findData(key, id) {
    return getData(key, []).find(function (r) { return r.id === id; }) || null;
  }

  /* ---------- settings / preferences ---------- */
  function defaultPrefs() {
    return { theme: 'light', notifications: { deadlines: true, overdue: true, announcements: true, study: true }, dismissed: [] };
  }
  function getPrefs(userId) {
    var s = getData('settings', {});
    var p = (s.userPrefs && s.userPrefs[userId]) || {};
    var d = defaultPrefs();
    return {
      theme: p.theme || d.theme,
      notifications: Object.assign({}, d.notifications, p.notifications || {}),
      dismissed: Array.isArray(p.dismissed) ? p.dismissed : []
    };
  }
  function setPrefs(userId, patch) {
    var s = getData('settings', {});
    s.userPrefs = s.userPrefs || {};
    var cur = getPrefs(userId);
    s.userPrefs[userId] = Object.assign({}, cur, patch);
    return saveData('settings', s);
  }

  /* ---------- activity log ---------- */
  function logActivity(userId, role, action, detail) {
    var logs = getData('activityLogs', []);
    logs.push({
      id: generateUniqueId('log'), userId: userId, role: role, action: action,
      detail: detail || '', createdAt: new Date().toISOString()
    });
    if (logs.length > 400) logs = logs.slice(logs.length - 400);
    saveData('activityLogs', logs);
  }

  /* ---------- password hashing (demo only, NOT secure) ---------- */
  function hashPassword(pw) {
    var str = 'stp::' + pw, h1 = 0xdeadbeef, h2 = 0x41c6ce57, ch, i;
    for (i = 0; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  /* ---------- session / current user ---------- */
  function getBase() {
    var b = document.body && document.body.getAttribute('data-base');
    return b == null ? '' : b;
  }

  function setSession(userId, role) {
    return saveData('session', { userId: userId, role: role, loginAt: new Date().toISOString() });
  }

  function getCurrentUser() {
    var s = getData('session', null);
    if (!s || !s.userId || !s.role) return null;
    if (s.role === 'admin') {
      var a = getData('admin', null);
      return a && a.id === s.userId ? Object.assign({}, a, { role: 'admin' }) : null;
    }
    if (s.role === 'student') {
      var st = getData('students', []).find(function (x) { return x.id === s.userId; });
      if (!st || st.status === 'inactive') return null;
      return Object.assign({}, st, { role: 'student' });
    }
    return null;
  }
  function isAdmin() { var u = getCurrentUser(); return !!u && u.role === 'admin'; }
  function isStudent() { var u = getCurrentUser(); return !!u && u.role === 'student'; }

  function logout(silent) {
    try { sessionStorage.setItem('stp_flash', JSON.stringify({ type: 'success', msg: 'You have been logged out successfully.' })); } catch (e) { /* ignore */ }
    localStorage.removeItem(KEYS.session);
    global.dispatchEvent(new CustomEvent('stp:change', { detail: { key: KEYS.session } }));
    if (!silent) global.location.href = getBase() + 'login.html';
  }

  /* ---------- demo seed data ---------- */
  function buildSeed() {
    var today = todayStr();
    var D = function (off) { return addDays(today, off); };
    var students = [
      { id: 'stu_aisha', rollNo: 'CS2021001', name: 'Aisha Rahman', email: 'aisha@student.edu', department: 'Computer Science', semester: 5, ago: 150 },
      { id: 'stu_rohan', rollNo: 'CS2022014', name: 'Rohan Mehta', email: 'rohan@student.edu', department: 'Computer Science', semester: 3, ago: 96 },
      { id: 'stu_meera', rollNo: 'EC2021007', name: 'Meera Nair', email: 'meera@student.edu', department: 'Electronics & Communication', semester: 5, ago: 61 },
      { id: 'stu_karthik', rollNo: 'ME2020022', name: 'Karthik Iyer', email: 'karthik@student.edu', department: 'Mechanical Engineering', semester: 7, ago: 33 },
      { id: 'stu_sara', rollNo: 'BA2022030', name: 'Sara Thomas', email: 'sara@student.edu', department: 'Business Administration', semester: 3, ago: 9 }
    ].map(function (s) {
      return {
        id: s.id, rollNo: s.rollNo, name: s.name, email: s.email, passwordHash: hashPassword('Student@123'),
        department: s.department, semester: s.semester, avatar: '', status: 'active', createdAt: isoDaysAgo(s.ago, 11)
      };
    });

    function T(owner, title, subject, category, priority, startOff, dueOff, hours, status, createdAgo, doneAgo, desc) {
      return {
        id: generateUniqueId('tsk'), studentId: owner, title: title, description: desc || '', subject: subject, category: category,
        priority: priority, startDate: D(startOff), dueDate: D(dueOff), estimatedHours: hours, status: status,
        createdAt: isoDaysAgo(createdAgo, 9), updatedAt: isoDaysAgo(status === 'Completed' ? doneAgo : createdAgo, 12),
        completedAt: status === 'Completed' ? isoDaysAgo(doneAgo, 8) : ''
      };
    }
    var tasks = [
      T('stu_aisha', 'Implement AVL tree in C++', 'Data Structures', 'Assignment', 'High', -6, 2, 4, 'In Progress', 6, 0, 'Insert, delete and rotation routines with a small test driver.'),
      T('stu_aisha', 'Database normalization worksheet', 'Database Systems', 'Assignment', 'Medium', -10, -2, 2, 'Pending', 10, 0, 'Normalize the given schema up to BCNF and justify each step.'),
      T('stu_aisha', 'Operating Systems mid-term revision', 'Operating Systems', 'Exam Preparation', 'High', -2, 5, 8, 'Pending', 3, 0, 'Scheduling, deadlocks, paging and segmentation.'),
      T('stu_aisha', 'Read chapter 7: TCP/IP', 'Computer Networks', 'Reading', 'Low', -8, -5, 1.5, 'Completed', 8, 4, ''),
      T('stu_aisha', 'Prepare ML seminar slides', 'Machine Learning', 'Presentation', 'Medium', -5, 9, 3, 'Pending', 5, 0, 'Topic: bias-variance trade-off with two worked examples.'),
      T('stu_aisha', 'Web project: UI mock-ups', 'Web Development', 'Project', 'Medium', -9, -1, 5, 'Completed', 9, 1, 'Figma mock-ups for the library portal.'),
      T('stu_aisha', 'Lab record: SQL joins', 'Database Systems', 'Lab Work', 'Low', -4, 0, 1, 'Pending', 4, 0, ''),
      T('stu_aisha', 'Compiler design quiz prep', 'Compiler Design', 'Exam Preparation', 'Medium', -6, -3, 2, 'Completed', 7, 2, ''),
      T('stu_aisha', 'Weekly algorithm practice set', 'Data Structures', 'Personal', 'Low', -3, 1, 2, 'Completed', 3, 0, ''),
      T('stu_rohan', 'Linked list lab programs', 'Data Structures', 'Lab Work', 'High', -3, 1, 3, 'In Progress', 4, 0, 'Singly, doubly and circular lists.'),
      T('stu_rohan', 'Discrete maths problem set 4', 'Mathematics', 'Assignment', 'Medium', -8, -3, 3, 'Pending', 8, 0, ''),
      T('stu_rohan', 'Digital logic notes summary', 'Digital Logic', 'Reading', 'Low', -1, 6, 2, 'Pending', 2, 0, ''),
      T('stu_rohan', 'C programming practice set', 'Programming', 'Lab Work', 'Medium', -7, -2, 2, 'Completed', 7, 2, ''),
      T('stu_meera', 'Analog circuits lab report', 'Analog Circuits', 'Lab Work', 'High', -5, 3, 4, 'In Progress', 5, 0, 'Include waveforms for the common-emitter amplifier.'),
      T('stu_meera', 'Signals & systems tutorial', 'Signals & Systems', 'Assignment', 'Medium', -6, -1, 2, 'Pending', 6, 0, ''),
      T('stu_meera', 'Microcontroller project proposal', 'Embedded Systems', 'Project', 'High', -2, 10, 6, 'Pending', 2, 0, ''),
      T('stu_meera', 'PCB design reading', 'Electronics', 'Reading', 'Low', -6, -3, 1.5, 'Completed', 6, 3, ''),
      T('stu_karthik', 'Thermodynamics problem sheet', 'Thermodynamics', 'Assignment', 'Medium', -2, 4, 3, 'Pending', 2, 0, ''),
      T('stu_karthik', 'CAD drawing submission', 'Engineering Graphics', 'Assignment', 'High', -7, 0, 5, 'In Progress', 7, 0, ''),
      T('stu_karthik', 'Fluid mechanics viva prep', 'Fluid Mechanics', 'Exam Preparation', 'Medium', -5, -1, 3, 'Completed', 5, 1, ''),
      T('stu_karthik', 'Industrial visit report', 'Manufacturing', 'Project', 'Medium', -9, -4, 3, 'Pending', 9, 0, ''),
      T('stu_sara', 'Marketing case study analysis', 'Marketing', 'Project', 'High', -4, 2, 4, 'In Progress', 4, 0, ''),
      T('stu_sara', 'Accounting ledger exercise', 'Accounting', 'Assignment', 'Medium', -5, -2, 2, 'Completed', 5, 2, ''),
      T('stu_sara', 'Economics reading: demand curves', 'Economics', 'Reading', 'Low', -1, 7, 1.5, 'Pending', 1, 0, '')
    ];

    function A(owner, title, subject, desc, assignedOff, deadlineOff, status, progress, createdAgo, submittedAgo) {
      return {
        id: generateUniqueId('asg'), studentId: owner, title: title, subject: subject, description: desc,
        assignedDate: D(assignedOff), deadline: D(deadlineOff), status: status, progress: progress,
        submittedAt: status === 'Submitted' ? isoDaysAgo(submittedAgo, 15) : '',
        createdAt: isoDaysAgo(createdAgo, 10), updatedAt: isoDaysAgo(createdAgo, 10)
      };
    }
    var assignments = [
      A('stu_aisha', 'Data Structures Assignment 3', 'Data Structures', 'Trees, heaps and balanced search trees.', -12, 3, 'In Progress', 60, 12, 0),
      A('stu_aisha', 'DBMS ER Diagram Submission', 'Database Systems', 'ER model for a hospital management system.', -15, -3, 'Submitted', 100, 15, 4),
      A('stu_aisha', 'OS Scheduling Algorithms Report', 'Operating Systems', 'Compare FCFS, SJF, Round Robin and MLFQ.', -7, -1, 'Not Started', 0, 7, 0),
      A('stu_rohan', 'Discrete Maths Assignment 2', 'Mathematics', 'Graph theory exercises.', -9, 2, 'In Progress', 40, 9, 0),
      A('stu_rohan', 'C Programming Lab Record', 'Programming', 'Complete lab record with outputs.', -20, -6, 'Submitted', 100, 20, 7),
      A('stu_meera', 'Network Theory Assignment', 'Electronics', 'Thevenin and Norton equivalents.', -8, 5, 'Not Started', 0, 8, 0),
      A('stu_meera', 'Analog Circuits Report', 'Analog Circuits', 'Report for experiments 1 to 5.', -14, -2, 'Submitted', 100, 14, 3),
      A('stu_karthik', 'Thermodynamics Assignment 1', 'Thermodynamics', 'Laws of thermodynamics and cycles.', -10, 1, 'In Progress', 75, 10, 0),
      A('stu_sara', 'Marketing Plan Draft', 'Marketing', 'Draft a marketing plan for a campus cafe.', -6, 6, 'In Progress', 30, 6, 0),
      A('stu_sara', 'Financial Accounting Assignment', 'Accounting', 'Trial balance and final accounts.', -13, -5, 'Submitted', 100, 13, 6)
    ];

    function S(owner, subject, dayOff, start, end, goals, status, createdAgo) {
      return {
        id: generateUniqueId('sts'), studentId: owner, subject: subject, date: D(dayOff), startTime: start, endTime: end,
        goals: goals, status: status, createdAt: isoDaysAgo(createdAgo, 8)
      };
    }
    var studySessions = [
      S('stu_aisha', 'Computer Networks', 0, '09:00', '10:00', 'Revise TCP congestion control.', 'Completed', 2),
      S('stu_aisha', 'Data Structures', 0, '18:00', '19:30', 'Finish AVL rotations and write test cases.', 'Planned', 2),
      S('stu_aisha', 'Operating Systems', 1, '17:00', '18:30', 'Solve previous year scheduling problems.', 'Planned', 2),
      S('stu_aisha', 'Machine Learning', 2, '19:00', '20:00', 'Outline seminar slides.', 'Planned', 1),
      S('stu_aisha', 'Database Systems', -1, '16:00', '17:00', 'Normalization practice.', 'Completed', 3),
      S('stu_aisha', 'Web Development', -2, '15:00', '17:00', 'Finalize responsive layout.', 'Completed', 4),
      S('stu_aisha', 'Compiler Design', 3, '10:00', '11:30', 'Parsing techniques revision.', 'Planned', 1),
      S('stu_rohan', 'Mathematics', 0, '16:00', '17:30', 'Graph theory problem set.', 'Planned', 2),
      S('stu_rohan', 'Data Structures', 1, '18:00', '19:00', 'Finish linked list programs.', 'Planned', 2),
      S('stu_meera', 'Analog Circuits', 0, '10:00', '11:30', 'Compile lab report observations.', 'In Progress', 2),
      S('stu_karthik', 'Engineering Graphics', 1, '14:00', '16:00', 'Complete CAD drawing sheet.', 'Planned', 1),
      S('stu_sara', 'Marketing', 2, '11:00', '12:30', 'Case study analysis.', 'Planned', 1)
    ];

    function TD(owner, text, done, ago) {
      return { id: generateUniqueId('tdo'), studentId: owner, text: text, done: done, createdAt: isoDaysAgo(ago, 9), completedAt: done ? isoDaysAgo(ago, 12) : '' };
    }
    var todos = [
      TD('stu_aisha', 'Submit scholarship form', false, 2),
      TD('stu_aisha', 'Buy new lab record book', true, 3),
      TD('stu_aisha', 'Bring laptop charger to college', false, 0),
      TD('stu_aisha', 'Email professor about project topic', false, 1),
      TD('stu_rohan', 'Return library books', false, 1),
      TD('stu_meera', 'Collect hall ticket', true, 2),
      TD('stu_karthik', 'Print CAD drawing sheets', false, 0)
    ];

    function N(owner, title, subject, content, createdAgo, updatedAgo) {
      return { id: generateUniqueId('not'), studentId: owner, title: title, subject: subject, content: content, createdAt: isoDaysAgo(createdAgo, 10), updatedAt: isoDaysAgo(updatedAgo, 10) };
    }
    var notes = [
      N('stu_aisha', 'AVL rotation cheat-sheet', 'Data Structures', 'LL case: single right rotation\nRR case: single left rotation\nLR case: left rotate child, then right rotate node\nRL case: right rotate child, then left rotate node\n\nBalance factor = height(left) - height(right). Rebalance when |bf| > 1.', 5, 3),
      N('stu_aisha', 'TCP three-way handshake', 'Computer Networks', 'SYN -> SYN+ACK -> ACK.\nSequence numbers are chosen randomly to avoid confusion with old segments.\nConnection teardown uses FIN/ACK in both directions (four-way).', 8, 8),
      N('stu_rohan', 'Discrete maths formulas', 'Mathematics', 'Handshake lemma: sum of degrees = 2|E|.\nA tree with n vertices has n-1 edges.', 4, 4),
      N('stu_meera', 'Transistor biasing notes', 'Analog Circuits', 'Voltage divider bias gives the best stability for the Q-point.', 6, 5)
    ];

    var adminName = 'System Administrator';
    function AN(title, desc, audience, dept, sem, priority, dayOff, status, createdAgo) {
      return {
        id: generateUniqueId('ann'), title: title, description: desc, audience: audience, department: dept, semester: sem,
        priority: priority, publishDate: D(dayOff), status: status, adminName: adminName,
        createdAt: isoDaysAgo(createdAgo, 9), updatedAt: isoDaysAgo(createdAgo, 9)
      };
    }
    var announcements = [
      AN('Mid-semester examination schedule released', 'The timetable for the mid-semester examinations is now available on the notice board. Please plan your revision accordingly and report any clashes to the exam cell within two days.', 'all', '', '', 'High', -2, 'Published', 2),
      AN('CS department: Hackathon registrations open', 'The annual 24-hour hackathon is open for registration. Teams of up to four students can register through the department office. Exciting prizes await the winners!', 'department', 'Computer Science', '', 'Medium', -1, 'Published', 1),
      AN('Semester 5 project review week', 'Project reviews for all Semester 5 students begin next week. Make sure your progress report and demo are ready before your slot.', 'semester', '', 5, 'High', 0, 'Published', 0),
      AN('Library extended hours during exams', 'The central library will remain open until 10 PM during the examination period. Please carry your ID card.', 'all', '', '', 'Low', -6, 'Published', 6),
      AN('Mechanical Engineering: industrial visit', 'The industrial visit to the manufacturing plant is scheduled for next month. Submit consent forms to the department office.', 'department', 'Mechanical Engineering', '', 'Medium', -3, 'Published', 3),
      AN('Resume-building workshop (scheduled)', 'A hands-on workshop on writing effective resumes will be held by the placement cell. Registration details will be shared on the day.', 'all', '', '', 'Low', 4, 'Published', 0),
      AN('Annual day volunteers needed (draft)', 'We are looking for student volunteers for the annual day. Details to be finalised before publishing.', 'all', '', '', 'Low', 10, 'Draft', 0)
    ];

    function LG(userId, role, action, detail, ago, hour) {
      return { id: generateUniqueId('log'), userId: userId, role: role, action: action, detail: detail, createdAt: isoDaysAgo(ago, hour) };
    }
    var activityLogs = [
      LG('stu_aisha', 'student', 'Registered', 'Created a student account', 150, 11),
      LG('stu_rohan', 'student', 'Registered', 'Created a student account', 96, 11),
      LG('stu_meera', 'student', 'Registered', 'Created a student account', 61, 11),
      LG('stu_karthik', 'student', 'Registered', 'Created a student account', 33, 11),
      LG('stu_sara', 'student', 'Registered', 'Created a student account', 9, 11),
      LG('stu_aisha', 'student', 'Completed task', 'Read chapter 7: TCP/IP', 4, 8),
      LG('stu_aisha', 'student', 'Completed task', 'Compiler design quiz prep', 2, 8),
      LG('stu_aisha', 'student', 'Added task', 'Operating Systems mid-term revision', 3, 9),
      LG('stu_aisha', 'student', 'Submitted assignment', 'DBMS ER Diagram Submission', 4, 15),
      LG('stu_aisha', 'student', 'Completed task', 'Web project: UI mock-ups', 1, 8),
      LG('stu_aisha', 'student', 'Added study session', 'Data Structures', 2, 8),
      LG('stu_rohan', 'student', 'Completed task', 'C programming practice set', 2, 8),
      LG('stu_meera', 'student', 'Added task', 'Microcontroller project proposal', 2, 9),
      LG(ADMIN_ID, 'admin', 'Published announcement', 'Semester 5 project review week', 0, 9)
    ];

    return {
      students: students,
      admin: {
        id: ADMIN_ID, username: 'admin', passwordHash: hashPassword('Admin@123'), name: adminName,
        email: 'admin@taskplanner.edu', createdAt: isoDaysAgo(200, 9)
      },
      tasks: tasks, assignments: assignments, studySessions: studySessions, todos: todos, notes: notes,
      announcements: announcements, notifications: [], activityLogs: activityLogs
    };
  }

  function seedAll(force) {
    var seed = buildSeed();
    Object.keys(seed).forEach(function (name) {
      var k = KEYS[name];
      if (force || localStorage.getItem(k) === null) saveData(name, seed[name]);
    });
    var settings = getData('settings', {});
    if (!settings || Array.isArray(settings)) settings = {};
    settings.initialized = true;
    settings.version = 1;
    settings.seededAt = settings.seededAt || new Date().toISOString();
    settings.userPrefs = settings.userPrefs || {};
    saveData('settings', settings);
  }

  /* Runs once per browser: after the first launch the flag in stp_settings
     prevents any re-initialisation, so user data is never overwritten. */
  function initDatabase() {
    if (global.__stpInitDone) return;
    global.__stpInitDone = true;
    var settings = getData('settings', null);
    if (settings && settings.initialized === true) return;
    seedAll(false);
  }

  /* Admin-only: wipe all application data and restore the demo data set. */
  function resetDemoData() {
    var old = getData('settings', {});
    var adminPrefs = old.userPrefs && old.userPrefs[ADMIN_ID];
    Object.keys(KEYS).forEach(function (n) {
      if (KEYS[n] !== KEYS.session) localStorage.removeItem(KEYS[n]);
    });
    seedAll(true);
    if (adminPrefs) {
      var s = getData('settings', {});
      s.userPrefs = s.userPrefs || {};
      s.userPrefs[ADMIN_ID] = adminPrefs;
      saveData('settings', s);
    }
    logActivity(ADMIN_ID, 'admin', 'Reset demo data', 'Demo data restored to defaults');
  }

  var api = {
    KEYS: KEYS, DEPARTMENTS: DEPARTMENTS, SEMESTERS: SEMESTERS, ADMIN_ID: ADMIN_ID,
    getData: getData, saveData: saveData, insertData: insertData, updateData: updateData, deleteData: deleteData,
    deleteWhere: deleteWhere, findData: findData, generateUniqueId: generateUniqueId,
    getCurrentUser: getCurrentUser, isAdmin: isAdmin, isStudent: isStudent, logout: logout, setSession: setSession,
    getPrefs: getPrefs, setPrefs: setPrefs, logActivity: logActivity, hashPassword: hashPassword,
    initDatabase: initDatabase, resetDemoData: resetDemoData, getBase: getBase,
    toDateStr: toDateStr, todayStr: todayStr, parseDate: parseDate, addDays: addDays
  };
  global.STP = api;
  Object.keys(api).forEach(function (k) { if (!(k in global)) global[k] = api[k]; });

  initDatabase();
})(window);

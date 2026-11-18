/* ==========================================================================
   announcements.js — read-only view of announcements targeted at this student
   ========================================================================== */
(function () {
  'use strict';
  var user = initShell();
  if (!user) return;
  var state = { q: '', priority: '' };

  var PRI = {
    High: { icon: 'fa-circle-exclamation', cls: 'ic-red' },
    Medium: { icon: 'fa-bullhorn', cls: 'ic-amber' },
    Low: { icon: 'fa-circle-info', cls: 'ic-blue' }
  };

  function audienceLabel(a) {
    if (a.audience === 'department') return a.department + ' department';
    if (a.audience === 'semester') return 'Semester ' + a.semester;
    return 'All students';
  }

  function render() {
    var me = getCurrentUser();
    if (!me) return;
    var q = state.q.toLowerCase();
    var visible = getData('announcements', []).filter(function (a) { return annVisibleTo(a, me); });
    var list = visible.filter(function (a) {
      if (state.priority && a.priority !== state.priority) return false;
      return !q || (a.title + ' ' + a.description).toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return b.publishDate.localeCompare(a.publishDate) || b.createdAt.localeCompare(a.createdAt); });

    $('#count').textContent = list.length + ' of ' + visible.length + ' announcements';
    $('#annList').innerHTML = list.length ? list.map(function (a, i) {
      var p = PRI[a.priority] || PRI.Low;
      return '<article class="ann-card" style="animation-delay:' + Math.min(i, 10) * 40 + 'ms"><div class="ann-ic ' + p.cls + '"><i class="fa-solid ' + p.icon + '"></i></div><div class="ann-body"><div class="flex between wrap gap-8" style="align-items:flex-start"><h3>' + esc(a.title) + '</h3>' + priorityBadge(a.priority) + '</div><p>' + esc(a.description) + '</p>' +
        '<div class="ann-meta"><span><i class="fa-regular fa-calendar"></i>Published ' + esc(fmtDate(a.publishDate)) + '</span><span><i class="fa-solid fa-user-shield"></i>' + esc(a.adminName || 'Administrator') + '</span><span class="chip"><i class="fa-solid fa-users"></i>' + esc(audienceLabel(a)) + '</span></div></div></article>';
    }).join('') : (visible.length
      ? emptyState('fa-magnifying-glass', 'No matching announcements', 'Try a different search or priority filter.', '')
      : emptyState('fa-bullhorn', 'No announcements yet', 'Announcements from your administrator will appear here.', ''));
  }

  $('#q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  $('#fPriority').addEventListener('change', function (e) { state.priority = e.target.value; render(); });
  render();
  onDataChange(render);
})();

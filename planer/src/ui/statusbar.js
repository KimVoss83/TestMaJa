// =========================================================
// NOTIFICATION BADGES
// =========================================================
export const _prevCounts = { messungen: 0, leitungen: 0, hilfslinien: 0 };
export function _notifyBadge(badgeId, sectionId, newCount, key) {
  if (newCount > _prevCounts[key]) {
    const sec = document.getElementById(sectionId);
    if (sec && !sec.classList.contains('open')) {
      const badge = document.getElementById(badgeId);
      if (badge) badge.classList.add('visible');
    }
  }
  _prevCounts[key] = newCount;
}

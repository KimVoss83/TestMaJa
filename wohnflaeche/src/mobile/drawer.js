import { state, _isTouchDevice } from '../state.js';
import { canvas, wrapper } from '../canvas.js';
import { undo } from '../undo.js';
import { setTool } from '../tools/tool-manager.js';

// =========================================================
// MOBILE: DRAWER TOGGLE
// =========================================================
export function initMobileDrawer() {
  const _sidebar = document.getElementById('sidebar');
  const _drawerToggle = document.getElementById('mobile-drawer-toggle');
  const _drawerBackdrop = document.getElementById('drawer-backdrop');

  function openDrawer() {
    _sidebar.classList.add('drawer-open');
    _drawerBackdrop.style.display = 'block';
    requestAnimationFrame(() => _drawerBackdrop.classList.add('visible'));
    _drawerToggle.textContent = 'Schließen ▼';
    const tt = document.getElementById('touch-toolbar');
    if (tt) tt.style.display = 'none';
  }
  function closeDrawer() {
    _sidebar.classList.remove('drawer-open');
    _drawerBackdrop.classList.remove('visible');
    setTimeout(() => { _drawerBackdrop.style.display = 'none'; }, 260);
    _drawerToggle.textContent = 'Messungen & Bibliothek ▲';
    const tt = document.getElementById('touch-toolbar');
    if (tt && _isTouchDevice) tt.style.display = 'flex';
  }
  _drawerToggle.onclick = () => {
    _sidebar.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
  };
  _drawerBackdrop.onclick = closeDrawer;

  // Swipe-down auf Drawer schließt ihn
  let _drawerTouchY = null;
  _sidebar.addEventListener('touchstart', e => {
    _drawerTouchY = e.touches[0].clientY;
  }, { passive: true });
  _sidebar.addEventListener('touchmove', e => {
    if (_drawerTouchY == null) return;
    const dy = e.touches[0].clientY - _drawerTouchY;
    if (dy > 50 && _sidebar.scrollTop <= 0) closeDrawer();
  }, { passive: true });
  _sidebar.addEventListener('touchend', () => { _drawerTouchY = null; }, { passive: true });

  // Export openDrawer so that the mobile menu can call it
  return { openDrawer, closeDrawer };
}

// =========================================================
// MOBILE: BOTTOM TOUCH TOOLBAR
// =========================================================
export function initBottomToolbar({ openDrawer }) {
  if (!_isTouchDevice) return;

  const _ttToolMap = {
    'tt-select': 'select', 'tt-ref': 'ref', 'tt-distance': 'distance',
    'tt-area': 'area', 'tt-circle': 'circle',
  };
  Object.entries(_ttToolMap).forEach(([btnId, tool]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.onclick = () => setTool(tool);
  });
  document.getElementById('tt-undo').onclick = () => undo();

  // ── Mobile Drei-Punkte-Menü ──
  const _mmMenu = document.getElementById('mobile-menu');
  const _mmBackdrop = document.getElementById('mobile-menu-backdrop');

  function _openMobileMenu() {
    _mmBackdrop.classList.add('visible');
    // Force reflow so transition plays
    _mmMenu.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => _mmMenu.classList.add('visible')));
  }
  function _closeMobileMenu() {
    _mmMenu.classList.remove('visible');
    _mmBackdrop.classList.remove('visible');
    setTimeout(() => { if (!_mmMenu.classList.contains('visible')) _mmMenu.style.display = 'none'; }, 260);
  }

  document.getElementById('tt-more').onclick = _openMobileMenu;
  _mmBackdrop.onclick = _closeMobileMenu;

  // Datei-Aktionen: leiten an die existierenden Header-Buttons weiter
  document.getElementById('mm-upload').onclick = () => { _closeMobileMenu(); document.getElementById('file-input').click(); };
  document.getElementById('mm-save').onclick = () => { _closeMobileMenu(); document.getElementById('btn-central-save').click(); };
  document.getElementById('mm-load').onclick = () => { _closeMobileMenu(); document.getElementById('btn-central-load').click(); };
  document.getElementById('mm-undo').onclick = () => { undo(); };
  document.getElementById('mm-redo').onclick = () => { document.getElementById('btn-redo').click(); };
  document.getElementById('mm-clear').onclick = () => { _closeMobileMenu(); document.getElementById('btn-clear-all').click(); };
  document.getElementById('mm-help').onclick = () => { _closeMobileMenu(); document.getElementById('btn-help').click(); };
  document.getElementById('mm-drawer').onclick = () => { _closeMobileMenu(); setTimeout(openDrawer, 280); };

  // Farb-Punkte ins Menü spiegeln
  const _mmColors = document.getElementById('mm-colors');
  document.querySelectorAll('#color-picker .color-dot').forEach(dot => {
    const c = dot.dataset.color;
    const el = document.createElement('div');
    el.className = 'mm-color-dot' + (dot.classList.contains('active') ? ' active' : '');
    el.style.background = c;
    if (c === '#ffffff') el.style.border = '2px solid #666';
    el.onclick = () => {
      dot.click(); // trigger original color picker
      _mmColors.querySelectorAll('.mm-color-dot').forEach(d => d.classList.remove('active'));
      el.classList.add('active');
    };
    _mmColors.appendChild(el);
  });

  // Linienstärke ins Menü spiegeln
  const _mmLW = document.getElementById('mm-linewidths');
  document.querySelectorAll('#line-width-picker .lw-dot').forEach(dot => {
    const lw = dot.dataset.lw;
    const el = document.createElement('div');
    el.className = 'mm-lw-dot' + (dot.classList.contains('active') ? ' active' : '');
    el.innerHTML = `<svg width="22" height="22"><line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" stroke-width="${lw}"/></svg>`;
    el.onclick = () => {
      dot.click(); // trigger original lw picker
      _mmLW.querySelectorAll('.mm-lw-dot').forEach(d => d.classList.remove('active'));
      el.classList.add('active');
    };
    _mmLW.appendChild(el);
  });
}

// =========================================================
// MOBILE: CANVAS-GRÖßE BEI ORIENTATION-CHANGE
// =========================================================
export function initOrientationChange() {
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      canvas.setWidth(wrapper.clientWidth);
      canvas.setHeight(wrapper.clientHeight);
      canvas.renderAll();
    }, 200);
  });
}

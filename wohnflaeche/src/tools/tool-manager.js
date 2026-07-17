import { state, _isTouchDevice } from '../state.js';
import { canvas } from '../canvas.js';
import { showToast } from '../ui/modals.js';

// =========================================================
// TOOL MANAGEMENT
// =========================================================
export const TOOL_NAMES = {
  select: 'Auswahl', ref: 'Maßstab', distance: 'Distanz',
  area: 'Fläche', circle: 'Kreis', arc: 'Kreisabschnitt', label: 'Label',
};
export const TOOL_HINTS = {
  select: '',
  ref: 'Startpunkt klicken …',
  distance: 'Startpunkt klicken …',
  area: 'Punkte klicken → Doppelklick zum Abschluss · Shift halten = 90°',
  circle: 'Mittelpunkt klicken …',
  arc: 'Mittelpunkt klicken …',
  label: 'Klicken = neues Label · Doppelklick = bearbeiten',
};
export const MEASURE_TOOLS = ['distance', 'area', 'circle', 'arc'];

// ── Hook registry for cross-module calls ──────────────────
const _hooks = {};
export function registerToolHook(name, fn) { _hooks[name] = fn; }
export function callHook(name, ...args) { if (_hooks[name]) return _hooks[name](...args); }

// ── Injected callbacks (set via initToolManager) ──────────
let _cancelDrawing = () => {};
let _loupeHide = () => {};
let _mobileMagHide = () => {};

export function initToolManager({ cancelDrawing, loupeHide, mobileMagHide } = {}) {
  if (cancelDrawing)  _cancelDrawing  = cancelDrawing;
  if (loupeHide)      _loupeHide      = loupeHide;
  if (mobileMagHide)  _mobileMagHide  = mobileMagHide;
}

export function requireScale() {
  if (state.scale) return true;
  showToast('Bitte zuerst ein Referenzmaß setzen!', 'warning');
  setTool('ref');
  // Maßstab-Akkordeon kurz aufleuchten
  const scaleAcc = [...document.querySelectorAll('.acc-section')].find(s =>
    s.querySelector('.acc-title')?.textContent.trim() === 'Maßstab'
  );
  if (scaleAcc) {
    scaleAcc.classList.add('open');
    scaleAcc.style.transition = 'box-shadow 0.15s';
    scaleAcc.style.boxShadow = '0 0 0 2px #f59e0b';
    setTimeout(() => { scaleAcc.style.boxShadow = ''; }, 1200);
  }
  return false;
}

export function updateMeasureButtons() {
  MEASURE_TOOLS.forEach(id => {
    const btn = document.getElementById('btn-' + id);
    if (!btn) return;
    btn.classList.toggle('needs-ref', !state.scale);
    btn.title = !state.scale
      ? 'Zuerst Referenzmaß setzen!'
      : { distance: 'Distanz messen (2 Klicks)', area: 'Polygon-Fläche (Doppelklick zum Abschluss)', circle: 'Kreis: Klick = Mittelpunkt, 2. Klick = Radius', arc: 'Kreisabschnitt: 3 Klicks' }[id];
  });
}

// Mobile onboarding trigger
const _MOB_OB_TOOLS = ['ref','distance','area','circle','arc'];
export function _tryMobileOnboarding(t) {
  if (!_MOB_OB_TOOLS.includes(t)) return;
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isMobile || localStorage.getItem('gp_mobile_ob_seen')) return;
  const el = document.getElementById('mobile-onboarding');
  if (el) el.classList.add('visible');
}

export function setTool(t) {
  if (MEASURE_TOOLS.includes(t) && !requireScale()) return;
  _tryMobileOnboarding(t);
  state.tool = t;
  _cancelDrawing();
  Object.keys(TOOL_NAMES).forEach(id => {
    const btn = document.getElementById('btn-' + id);
    if (btn) btn.classList.toggle('active', id === t);
  });
  // Sync mobile bottom toolbar
  if (_isTouchDevice) {
    document.querySelectorAll('#touch-toolbar button[id^="tt-"]').forEach(btn => {
      const tool = btn.id.replace('tt-', '');
      btn.classList.toggle('active', tool === t);
    });
  }
  canvas.isDrawingMode = false;
  canvas.selection = (t === 'select');
  canvas.defaultCursor = t === 'select' ? 'default' : 'crosshair';
  if (t === 'select') _loupeHide();
  _mobileMagHide();
  canvas.forEachObject(o => {
    o.selectable = (t === 'select' && !o._noSelect) || (t === 'label' && !!o._userLabel);
    o.evented = o.selectable;
    // Lock movement for measurements, ref lines, guides — but NOT for labels, lib items
    const isMovable = !!o._userLabel || !!o._libItem || !!o._customLib;
    o.lockMovementX = !isMovable;
    o.lockMovementY = !isMovable;
  });
  document.getElementById('status-tool').textContent = 'Werkzeug: ' + TOOL_NAMES[t];
  document.getElementById('status-hint').textContent = TOOL_HINTS[t];
  const HELPER_TOOLS = ['distance', 'area'];
  document.getElementById('draw-helpers-group').style.display = HELPER_TOOLS.includes(t) ? '' : 'none';
  // Mobile helpers bar — hide when switching to a non-helper-compatible tool
  const mhb = document.getElementById('mobile-helpers-bar');
  if (mhb) {
    const HELPER_PARENT_TOOLS = ['ref', 'distance', 'area', 'circle', 'arc'];
    if (!HELPER_PARENT_TOOLS.includes(t)) mhb.classList.remove('visible');
  }
  // Sections stay collapsed — notification badges show new items
}

// Expose on window for legacy inline onclick handlers
window.setTool = setTool;

export function initToolbar() {
  // Toolbar button click handlers
  Object.keys(TOOL_NAMES).forEach(id => {
    const btn = document.getElementById('btn-' + id);
    if (btn) btn.onclick = () => setTool(id);
  });

  // Line width picker
  document.querySelectorAll('.lw-dot').forEach(dot => {
    dot.onclick = () => {
      document.querySelectorAll('.lw-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      state.lineWidth = parseInt(dot.dataset.lw);
    };
  });
  // Set default active (1px)
  document.querySelectorAll('.lw-dot').forEach(d => d.classList.toggle('active', d.dataset.lw === '1'));

  // Color picker
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.onclick = () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      state.color = dot.dataset.color;
    };
  });

  // Font size
  document.getElementById('font-size-input').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    if (v >= 6 && v <= 72) state.fontSize = v;
  });

  // Label background toggle
  const btnLabelBg = document.getElementById('btn-label-bg');
  const _bgIcon = btnLabelBg.querySelector('.btn-icon').outerHTML;
  btnLabelBg.onclick = () => {
    state.labelBg = !state.labelBg;
    btnLabelBg.innerHTML = _bgIcon + (state.labelBg ? ' BG: Hell' : ' BG: Dunkel');
    btnLabelBg.classList.toggle('active', state.labelBg);
  };
  // Expose sync helper so save-load.js can update the button after loading a project
  window._syncLabelBgBtn = () => {
    btnLabelBg.innerHTML = _bgIcon + (state.labelBg ? ' BG: Hell' : ' BG: Dunkel');
    btnLabelBg.classList.toggle('active', state.labelBg);
  };
}

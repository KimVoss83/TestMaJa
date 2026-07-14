import { state, PIPE_TYPES, _isTouchDevice } from '../state.js';
import { canvas } from '../canvas.js';
import { showToast } from '../ui/modals.js';

// =========================================================
// TOOL MANAGEMENT
// =========================================================
export const TOOL_NAMES = {
  select: 'Auswahl', ref: 'Maßstab', distance: 'Distanz',
  area: 'Fläche', circle: 'Kreis', arc: 'Kreisabschnitt', label: 'Label',
  pipe: 'Leitung'
};
export const TOOL_HINTS = {
  select: '',
  ref: 'Startpunkt klicken …',
  distance: 'Startpunkt klicken …',
  area: 'Punkte klicken → Doppelklick zum Abschluss · Shift halten = 90°',
  circle: 'Mittelpunkt klicken …',
  arc: 'Mittelpunkt klicken …',
  label: 'Klicken = neues Label · Doppelklick = bearbeiten',
  pipe: 'Punkte klicken → Doppelklick zum Abschluss',
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
const _MOB_OB_TOOLS = ['ref','distance','area','circle','arc','pipe'];
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
    o.selectable = (t === 'select' && !o._noSelect) || !!o._isPipeLegend || (t === 'label' && !!o._userLabel);
    o.evented = o.selectable;
    // Lock movement for measurements, ref lines, pipes, guides — but NOT for labels, lib items, dim foot handles
    const isMovable = !!o._userLabel || !!o._libItem || !!o._customLib || !!o._dimDraggableFoot;
    o.lockMovementX = !isMovable;
    o.lockMovementY = !isMovable;
  });
  document.getElementById('status-tool').textContent = 'Werkzeug: ' + TOOL_NAMES[t];
  document.getElementById('status-hint').textContent = TOOL_HINTS[t];
  document.getElementById('pipe-type-group').style.display = (t === 'pipe') ? '' : 'none';
  const HELPER_TOOLS = ['distance', 'area', 'pipe'];
  document.getElementById('draw-helpers-group').style.display = HELPER_TOOLS.includes(t) ? '' : 'none';
  // Mobile pipe bar
  const mpb = document.getElementById('mobile-pipe-bar');
  if (mpb) mpb.classList.toggle('visible', t === 'pipe');
  // Mobile helpers bar — hide when switching to a non-helper-compatible tool
  const mhb = document.getElementById('mobile-helpers-bar');
  if (mhb) {
    const HELPER_PARENT_TOOLS = ['ref', 'distance', 'area', 'circle', 'arc', 'pipe'];
    if (!HELPER_PARENT_TOOLS.includes(t)) mhb.classList.remove('visible');
  }
  const REF_TOOLS = ['ref', 'distance', 'area', 'circle', 'arc', 'pipe'];
  if (!REF_TOOLS.includes(t)) { state.pipeRefMode = null; state.pipeRefTempPt = null; }
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

  // Pipe type select
  (function initPipeSelect() {
    const sel = document.getElementById('pipe-type-select');
    const MAIN_PIPE_KEYS = ['TW','AW','RW','GB','G','St','GF','Cu','LR'];
    MAIN_PIPE_KEYS.forEach(key => {
      const pt = PIPE_TYPES[key];
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = `● ${pt.label}`; opt.style.color = pt.color;
      sel.appendChild(opt);
    });
    sel.value = state.pipeType;
    sel.onchange = () => { state.pipeType = sel.value; };
  })();

  // Mobile pipe type bar
  (function initMobilePipeBar() {
    const bar = document.getElementById('mobile-pipe-bar');
    if (!bar) return;
    const MAIN_PIPE_KEYS = ['TW','AW','RW','GB','G','St','GF','Cu','LR'];
    MAIN_PIPE_KEYS.forEach(key => {
      const pt = PIPE_TYPES[key];
      const chip = document.createElement('button');
      chip.className = 'mp-chip';
      chip.dataset.key = key;
      chip.innerHTML = `<span class="mp-dot" style="background:${pt.color}"></span>${pt.label}`;
      if (key === state.pipeType) chip.classList.add('active');
      chip.onclick = () => {
        state.pipeType = key;
        document.getElementById('pipe-type-select').value = key;
        bar.querySelectorAll('.mp-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      };
      bar.appendChild(chip);
    });
  })();

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

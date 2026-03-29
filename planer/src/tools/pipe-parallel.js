import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { projectPointOnLine, formatDistance } from '../utils/helpers.js';
import { showToast } from '../ui/modals.js';

// =========================================================
// PARALLEL SNAP — Leitung parallel zu Hilfslinie zeichnen
//
// Flow:
//   1. "Parallel"-Button → Hilfslinien hervorgehoben
//   2. Klick auf Hilfslinie → SOFORT aktiv mit letztem Abstand
//      Floating-Input erscheint zwischen Linie und Parallele
//   3. Abstand live ändern → Führungslinie passt sich sofort an
//   4. Klick auf andere Hilfslinie → sofort wechseln
//   5. Escape / Button → deaktivieren
// =========================================================

const PARALLEL_COLOR = '#00BCD4';
let _parallelGuideObjs = [];
let _parallelMode = null; // null | 'selecting' | 'active'
let _lastDistanceM = 0.60;
let _floatingInput = null; // DOM element für schwebendes Input

export function getParallelMode() { return _parallelMode; }

function clearParallelGuides() {
  _parallelGuideObjs.forEach(o => canvas.remove(o));
  _parallelGuideObjs = [];
}

// ── Floating Input auf Canvas ────────────────────────────

function createFloatingInput() {
  if (_floatingInput) return _floatingInput;
  const wrapper = document.getElementById('canvas-wrapper');
  const el = document.createElement('div');
  el.id = 'parallel-float';
  el.style.cssText = `
    position:absolute; z-index:100; display:none;
    background:#e0f7fa; border:2px solid ${PARALLEL_COLOR}; border-radius:8px;
    padding:4px 8px; box-shadow:0 2px 8px rgba(0,0,0,0.15);
    font-family:inherit; font-size:12px; color:#00695c;
    pointer-events:auto; transform:translate(-50%,-50%);
    display:none; align-items:center; gap:4px;
  `;
  el.innerHTML = `
    <input type="number" id="parallel-float-input" placeholder="m" min="0.01" step="0.01"
      style="width:60px;font-size:13px;padding:3px 6px;border:1px solid #00BCD4;border-radius:5px;
      font-family:monospace;font-weight:bold;background:#fff;text-align:center;color:#00695c;" />
    <span style="font-size:11px;font-weight:600;">m</span>
    <span id="parallel-float-name" style="font-size:10px;color:#00838f;margin-left:2px;"></span>
  `;
  wrapper.appendChild(el);
  _floatingInput = el;

  const input = el.querySelector('#parallel-float-input');
  input.addEventListener('input', () => {
    const dist = parseFloat(input.value);
    if (!isNaN(dist) && dist > 0) {
      _lastDistanceM = dist;
      if (state.parallelSnap) {
        state.parallelSnap.distanceM = dist;
        state.parallelSnap.distancePx = dist * state.scale * state.imgDisplayScale;
      }
    }
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); deactivateParallelSnap(); }
    e.stopPropagation(); // Keyboard-Events nicht an Canvas weiterleiten
  });
  // Prevent canvas clicks when clicking on the input
  el.addEventListener('mousedown', e => e.stopPropagation());
  el.addEventListener('touchstart', e => e.stopPropagation());

  return el;
}

function showFloatingInput(ref, distanceM) {
  const el = createFloatingInput();
  const input = el.querySelector('#parallel-float-input');
  const nameEl = el.querySelector('#parallel-float-name');

  input.value = distanceM;
  nameEl.textContent = ref.name;
  el.style.display = 'flex';

  // Position: Mittelpunkt der Hilfslinie, leicht versetzt
  positionFloatingInput(ref);

  setTimeout(() => { input.focus(); input.select(); }, 80);
}

function positionFloatingInput(ref) {
  if (!_floatingInput || !ref) return;
  const vpt = canvas.viewportTransform;
  const mx = (ref.x1 + ref.x2) / 2;
  const my = (ref.y1 + ref.y2) / 2;
  // Canvas-Koordinaten → Screen-Koordinaten
  const sx = mx * vpt[0] + vpt[4];
  const sy = my * vpt[3] + vpt[5];
  // Leicht oberhalb der Hilfslinie
  _floatingInput.style.left = sx + 'px';
  _floatingInput.style.top = (sy - 30) + 'px';
}

function hideFloatingInput() {
  if (_floatingInput) _floatingInput.style.display = 'none';
}

// ── Highlight Hilfslinien ────────────────────────────────

let _highlightObjs = [];
function showRefHighlights() {
  clearRefHighlights();
  state.pipeReferences.filter(r => r.type === 'line').forEach(ref => {
    const hl = new fabric.Line([ref.x1, ref.y1, ref.x2, ref.y2], {
      stroke: PARALLEL_COLOR, strokeWidth: 6, opacity: 0.3,
      selectable: false, evented: false, _noSelect: true, _parallelHighlight: true,
    });
    canvas.add(hl);
    _highlightObjs.push(hl);
  });
  canvas.renderAll();
}
function clearRefHighlights() {
  _highlightObjs.forEach(o => canvas.remove(o));
  _highlightObjs = [];
}

// ── Finde Hilfslinie nahe Punkt ──────────────────────────

export function findRefLineNearPoint(p, threshold = 15) {
  const lineRefs = state.pipeReferences.filter(r => r.type === 'line');
  let bestRef = null, bestDist = threshold;
  for (const ref of lineRefs) {
    const proj = projectPointOnLine(p, ref);
    if (proj.t < -0.15 || proj.t > 1.15) continue;
    if (proj.dist < bestDist) { bestDist = proj.dist; bestRef = ref; }
  }
  return bestRef;
}

// ── Parallel-Punkt berechnen ─────────────────────────────

function computeParallelPoint(cursorPt, ref, distancePx) {
  const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return cursorPt;
  const nx = -dy / len, ny = dx / len;
  const cross = dx * (cursorPt.y - ref.y1) - dy * (cursorPt.x - ref.x1);
  const side = cross >= 0 ? 1 : -1;
  const offRef = {
    x1: ref.x1 + nx * distancePx * side, y1: ref.y1 + ny * distancePx * side,
    x2: ref.x2 + nx * distancePx * side, y2: ref.y2 + ny * distancePx * side,
  };
  return projectPointOnLine(cursorPt, offRef).point;
}

export function applyParallelSnap(p) {
  if (_parallelMode !== 'active' || !state.parallelSnap) return p;
  const { refId, distancePx } = state.parallelSnap;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref || ref.type !== 'line') return p;
  return computeParallelPoint(p, ref, distancePx);
}

export function drawParallelPreview(cursorPt) {
  clearParallelGuides();
  if (_parallelMode !== 'active' || !state.parallelSnap) return;
  const { refId, distancePx } = state.parallelSnap;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref || ref.type !== 'line') return;

  const snapped = computeParallelPoint(cursorPt, ref, distancePx);
  const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const nx = -dy / len, ny = dx / len;
  const cross = dx * (cursorPt.y - ref.y1) - dy * (cursorPt.x - ref.x1);
  const side = cross >= 0 ? 1 : -1;
  const extend = 5000;
  const ux = dx / len, uy = dy / len;
  const cx = (ref.x1 + ref.x2) / 2 + nx * distancePx * side;
  const cy = (ref.y1 + ref.y2) / 2 + ny * distancePx * side;

  // Führungslinie
  const guideLine = new fabric.Line(
    [cx - ux * extend, cy - uy * extend, cx + ux * extend, cy + uy * extend],
    { stroke: PARALLEL_COLOR, strokeWidth: 1, strokeDashArray: [8, 4], opacity: 0.7,
      selectable: false, evented: false, _noSelect: true }
  );
  canvas.add(guideLine);
  _parallelGuideObjs.push(guideLine);

  // Senkrechte
  const projOnRef = projectPointOnLine(snapped, ref);
  const perpLine = new fabric.Line(
    [snapped.x, snapped.y, projOnRef.point.x, projOnRef.point.y],
    { stroke: PARALLEL_COLOR, strokeWidth: 0.7, strokeDashArray: [3, 2], opacity: 0.8,
      selectable: false, evented: false, _noSelect: true }
  );
  canvas.add(perpLine);
  _parallelGuideObjs.push(perpLine);

  // Abstandslabel auf Canvas
  const pxDist = projOnRef.dist / state.imgDisplayScale;
  const meters = state.scale ? pxDist / state.scale : null;
  const label = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;
  const mx = (snapped.x + projOnRef.point.x) / 2;
  const my = (snapped.y + projOnRef.point.y) / 2;
  const txt = new fabric.Text(label, {
    left: mx + 8, top: my,
    fontSize: 6, fontWeight: 'bold', fontFamily: 'monospace',
    fill: PARALLEL_COLOR, backgroundColor: 'rgba(255,255,255,0.9)', padding: 1,
    originX: 'center', originY: 'center',
    selectable: false, evented: false, _noSelect: true,
  });
  canvas.add(txt);
  _parallelGuideObjs.push(txt);

  // Floating input Position aktualisieren (folgt Viewport)
  positionFloatingInput(ref);
}

// ── Öffentliche API ──────────────────────────────────────

function activateWithRef(ref, distanceM) {
  _lastDistanceM = distanceM;
  const distancePx = distanceM * state.scale * state.imgDisplayScale;
  state.parallelSnap = { refId: ref.id, distancePx, distanceM };
  _parallelMode = 'active';
  clearRefHighlights();

  const btn = document.getElementById('btn-parallel-snap');
  if (btn) btn.classList.add('active');

  // Toolbar-Gruppe verstecken, stattdessen Floating-Input
  const group = document.getElementById('parallel-dist-group');
  if (group) group.style.display = 'none';

  showFloatingInput(ref, distanceM);

  document.getElementById('status-hint').textContent =
    `Parallel zu "${ref.name}": ${distanceM} m – Klick auf andere Hilfslinie = wechseln`;
}

export function startParallelSelect() {
  if (!state.scale) { showToast('Bitte zuerst Maßstab setzen!', 'warning'); return; }
  const lineRefs = state.pipeReferences.filter(r => r.type === 'line');
  if (lineRefs.length === 0) { showToast('Keine Hilfslinien vorhanden.', 'warning'); return; }

  if (lineRefs.length === 1) {
    activateWithRef(lineRefs[0], _lastDistanceM);
    return;
  }

  _parallelMode = 'selecting';
  showRefHighlights();
  document.getElementById('btn-parallel-snap').classList.add('active');
  document.getElementById('status-hint').textContent =
    'Auf eine Hilfslinie klicken zum Ausrichten …';
}

export function updateParallelDist() {
  // Handled by floating input's own event listeners
}

export function deactivateParallelSnap() {
  _parallelMode = null;
  state.parallelSnap = null;
  clearParallelGuides();
  clearRefHighlights();
  hideFloatingInput();
  const btn = document.getElementById('btn-parallel-snap');
  if (btn) btn.classList.remove('active');
  const group = document.getElementById('parallel-dist-group');
  if (group) group.style.display = 'none';
}

export function toggleParallelSnap() {
  if (_parallelMode) { deactivateParallelSnap(); }
  else { startParallelSelect(); }
}

export function handleParallelClick(p) {
  if (_parallelMode === 'selecting') {
    const ref = findRefLineNearPoint(p);
    if (ref) {
      activateWithRef(ref, _lastDistanceM);
      return true;
    }
    return false;
  }

  if (_parallelMode === 'active') {
    const ref = findRefLineNearPoint(p);
    if (ref && ref.id !== state.parallelSnap?.refId) {
      activateWithRef(ref, state.parallelSnap?.distanceM || _lastDistanceM);
      return true;
    }
  }

  return false;
}

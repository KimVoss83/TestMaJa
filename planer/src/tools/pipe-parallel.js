import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { projectPointOnLine, formatDistance } from '../utils/helpers.js';
import { showToast } from '../ui/modals.js';

// =========================================================
// PARALLEL SNAP — Leitung parallel zu Hilfslinie zeichnen
//
// Flow:
//   1. User klickt "Parallel"-Button → Auswahlmodus aktiv
//   2. User klickt auf eine Hilfslinie im Canvas → Linie wird gewählt
//   3. Abstand-Input erscheint inline, User tippt Abstand + Enter
//   4. Parallel-Snap ist aktiv, Cursor wird projiziert
//   5. Beim Zeichnen: Klick auf andere Hilfslinie → wechselt sofort
//   6. Escape oder Button → deaktiviert
// =========================================================

const PARALLEL_COLOR = '#00BCD4';
const PARALLEL_SELECT_COLOR = '#00BCD4';

// Sub-Modus: null | 'selecting' | 'active'
// 'selecting' = warte auf Klick auf Hilfslinie
// 'active' = parallel snap aktiv, zeichne parallel

let _parallelGuideObjs = [];
let _parallelMode = null; // null | 'selecting' | 'active'

export function getParallelMode() { return _parallelMode; }

function clearParallelGuides() {
  _parallelGuideObjs.forEach(o => canvas.remove(o));
  _parallelGuideObjs = [];
}

// Highlight alle Hilfslinien visuell wenn im Auswahlmodus
let _highlightObjs = [];
function showRefHighlights() {
  clearRefHighlights();
  state.pipeReferences.filter(r => r.type === 'line').forEach(ref => {
    // Breiter unsichtbarer Hitbereich + sichtbarer Highlight
    const hl = new fabric.Line([ref.x1, ref.y1, ref.x2, ref.y2], {
      stroke: PARALLEL_SELECT_COLOR, strokeWidth: 6, opacity: 0.3,
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

// Prüfe ob ein Klickpunkt nahe einer Hilfslinie ist → gibt ref zurück oder null
export function findRefLineNearPoint(p, threshold = 12) {
  const lineRefs = state.pipeReferences.filter(r => r.type === 'line');
  let bestRef = null, bestDist = threshold;
  for (const ref of lineRefs) {
    const proj = projectPointOnLine(p, ref);
    // Prüfe ob Projektion innerhalb des Segments liegt (mit etwas Toleranz)
    const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const t = proj.t;
    if (t < -0.1 || t > 1.1) continue; // außerhalb des Segments
    if (proj.dist < bestDist) {
      bestDist = proj.dist;
      bestRef = ref;
    }
  }
  return bestRef;
}

// Punkt auf parallele Linie projizieren
function computeParallelPoint(cursorPt, ref, distancePx) {
  const dx = ref.x2 - ref.x1;
  const dy = ref.y2 - ref.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return cursorPt;

  const nx = -dy / len;
  const ny = dx / len;

  // Seite automatisch erkennen
  const cross = dx * (cursorPt.y - ref.y1) - dy * (cursorPt.x - ref.x1);
  const side = cross >= 0 ? 1 : -1;

  const offRef = {
    x1: ref.x1 + nx * distancePx * side,
    y1: ref.y1 + ny * distancePx * side,
    x2: ref.x2 + nx * distancePx * side,
    y2: ref.y2 + ny * distancePx * side,
  };

  const proj = projectPointOnLine(cursorPt, offRef);
  return proj.point;
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

  const dx = ref.x2 - ref.x1;
  const dy = ref.y2 - ref.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;

  const nx = -dy / len, ny = dx / len;
  const cross = dx * (cursorPt.y - ref.y1) - dy * (cursorPt.x - ref.x1);
  const side = cross >= 0 ? 1 : -1;

  // Verlängerte parallele Führungslinie
  const extend = 5000;
  const ux = dx / len, uy = dy / len;
  const cx = (ref.x1 + ref.x2) / 2 + nx * distancePx * side;
  const cy = (ref.y1 + ref.y2) / 2 + ny * distancePx * side;

  const guideLine = new fabric.Line(
    [cx - ux * extend, cy - uy * extend, cx + ux * extend, cy + uy * extend],
    { stroke: PARALLEL_COLOR, strokeWidth: 1, strokeDashArray: [8, 4], opacity: 0.7,
      selectable: false, evented: false, _noSelect: true }
  );
  canvas.add(guideLine);
  _parallelGuideObjs.push(guideLine);

  // Senkrechte zum Ref
  const projOnRef = projectPointOnLine(snapped, ref);
  const perpLine = new fabric.Line(
    [snapped.x, snapped.y, projOnRef.point.x, projOnRef.point.y],
    { stroke: PARALLEL_COLOR, strokeWidth: 0.7, strokeDashArray: [3, 2], opacity: 0.8,
      selectable: false, evented: false, _noSelect: true }
  );
  canvas.add(perpLine);
  _parallelGuideObjs.push(perpLine);

  // Abstandslabel
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
}

// ── Öffentliche API ──────────────────────────────────────

// Parallel-Modus starten: erst Hilfslinie auswählen
export function startParallelSelect() {
  if (!state.scale) {
    showToast('Bitte zuerst Maßstab setzen!', 'warning');
    return;
  }
  const lineRefs = state.pipeReferences.filter(r => r.type === 'line');
  if (lineRefs.length === 0) {
    showToast('Keine Hilfslinien vorhanden.', 'warning');
    return;
  }

  _parallelMode = 'selecting';
  showRefHighlights();
  document.getElementById('btn-parallel-snap').classList.add('active');
  document.getElementById('status-hint').textContent =
    'Auf eine Hilfslinie klicken zum Ausrichten …';
}

// Hilfslinie wurde angeklickt → Abstand eingeben
export function selectRefLine(ref) {
  clearRefHighlights();

  // Vorherigen Abstand merken falls vorhanden
  const prevDist = state.parallelSnap ? state.parallelSnap.distanceM : '';

  // Inline-Abstandseingabe zeigen
  const group = document.getElementById('parallel-dist-group');
  const input = document.getElementById('parallel-dist-inline');
  const nameEl = document.getElementById('parallel-ref-name');

  group.style.display = 'inline-flex';
  nameEl.textContent = ref.name;
  input.value = prevDist || '';
  input.focus();

  // Temporär speichern welche Ref gewählt wurde
  state._parallelPendingRefId = ref.id;

  document.getElementById('status-hint').textContent =
    `"${ref.name}" gewählt – Abstand in Meter eingeben + Enter`;
}

// Abstand bestätigt → Snap aktivieren
export function confirmParallelDist() {
  const input = document.getElementById('parallel-dist-inline');
  const dist = parseFloat(input.value);
  if (isNaN(dist) || dist <= 0) {
    showToast('Bitte gültigen Abstand eingeben.', 'warning');
    input.focus();
    return;
  }

  const refId = state._parallelPendingRefId;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref) return;

  const distancePx = dist * state.scale * state.imgDisplayScale;
  state.parallelSnap = { refId, distancePx, distanceM: dist };
  _parallelMode = 'active';
  delete state._parallelPendingRefId;

  document.getElementById('btn-parallel-snap').classList.add('active');
  document.getElementById('parallel-ref-name').textContent = ref.name;
  document.getElementById('status-hint').textContent =
    `Parallel zu "${ref.name}": ${dist} m – Klick auf andere Hilfslinie = wechseln`;
}

// Während aktivem Parallel-Snap auf andere Hilfslinie klicken → sofort wechseln
export function switchRefLine(ref) {
  const prevDist = state.parallelSnap ? state.parallelSnap.distanceM : null;
  if (prevDist) {
    // Direkt wechseln mit gleichem Abstand
    const distancePx = prevDist * state.scale * state.imgDisplayScale;
    state.parallelSnap = { refId: ref.id, distancePx, distanceM: prevDist };
    document.getElementById('parallel-ref-name').textContent = ref.name;
    document.getElementById('status-hint').textContent =
      `Parallel zu "${ref.name}": ${prevDist} m – Klick auf andere Hilfslinie = wechseln`;
  } else {
    // Kein vorheriger Abstand → Eingabe zeigen
    selectRefLine(ref);
  }
}

// Alles deaktivieren
export function deactivateParallelSnap() {
  _parallelMode = null;
  state.parallelSnap = null;
  delete state._parallelPendingRefId;
  clearParallelGuides();
  clearRefHighlights();
  const btn = document.getElementById('btn-parallel-snap');
  if (btn) btn.classList.remove('active');
  const group = document.getElementById('parallel-dist-group');
  if (group) group.style.display = 'none';
}

// Toggle-Funktion für den Button
export function toggleParallelSnap() {
  if (_parallelMode) {
    deactivateParallelSnap();
  } else {
    startParallelSelect();
  }
}

// Wird von main.js bei mouse:down im Pipe-Tool aufgerufen
// Gibt true zurück wenn der Klick konsumiert wurde (auf Hilfslinie)
export function handleParallelClick(p) {
  if (_parallelMode === 'selecting') {
    // Suche Hilfslinie am Klickpunkt
    const ref = findRefLineNearPoint(p);
    if (ref) {
      selectRefLine(ref);
      return true; // Klick konsumiert
    }
    return false;
  }

  if (_parallelMode === 'active') {
    // Prüfe ob auf eine andere Hilfslinie geklickt wurde → wechseln
    const ref = findRefLineNearPoint(p);
    if (ref && ref.id !== state.parallelSnap?.refId) {
      switchRefLine(ref);
      return true; // Klick konsumiert
    }
  }

  return false;
}

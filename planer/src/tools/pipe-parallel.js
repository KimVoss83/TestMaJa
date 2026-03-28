import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { projectPointOnLine, formatDistance } from '../utils/helpers.js';
import { createModal, showToast } from '../ui/modals.js';

// =========================================================
// PARALLEL SNAP — Leitung parallel zu Hilfslinie zeichnen
// =========================================================

const PARALLEL_COLOR = '#00BCD4';

// Temporäre Canvas-Objekte für die visuelle Führungslinie
let _parallelGuideObjs = [];

function clearParallelGuides() {
  _parallelGuideObjs.forEach(o => canvas.remove(o));
  _parallelGuideObjs = [];
}

// Berechne den parallel verschobenen Punkt
function computeParallelPoint(cursorPt, ref, distancePx) {
  // Richtung der Hilfslinie
  const dx = ref.x2 - ref.x1;
  const dy = ref.y2 - ref.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return cursorPt;

  // Normalenvektor (senkrecht zur Linie)
  const nx = -dy / len;
  const ny = dx / len;

  // Seite automatisch erkennen: auf welcher Seite des Cursors liegt die Hilfslinie?
  const cross = (dx) * (cursorPt.y - ref.y1) - (dy) * (cursorPt.x - ref.x1);
  const side = cross >= 0 ? 1 : -1;

  // Offset-Linie berechnen
  const offRef = {
    x1: ref.x1 + nx * distancePx * side,
    y1: ref.y1 + ny * distancePx * side,
    x2: ref.x2 + nx * distancePx * side,
    y2: ref.y2 + ny * distancePx * side,
  };

  // Cursor auf die Offset-Linie projizieren (ohne Clamping)
  const proj = projectPointOnLine(cursorPt, offRef);
  return proj.point;
}

export function applyParallelSnap(p) {
  if (!state.parallelSnap) return p;
  const { refId, distancePx } = state.parallelSnap;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref || ref.type !== 'line') return p;
  return computeParallelPoint(p, ref, distancePx);
}

export function drawParallelPreview(cursorPt) {
  clearParallelGuides();
  if (!state.parallelSnap) return;

  const { refId, distancePx } = state.parallelSnap;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref || ref.type !== 'line') return;

  const snapped = computeParallelPoint(cursorPt, ref, distancePx);

  // Richtung der Hilfslinie
  const dx = ref.x2 - ref.x1;
  const dy = ref.y2 - ref.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;

  const nx = -dy / len;
  const ny = dx / len;
  const cross = (dx) * (cursorPt.y - ref.y1) - (dy) * (cursorPt.x - ref.x1);
  const side = cross >= 0 ? 1 : -1;

  // Verlängerte parallele Führungslinie (weit über Bildschirmgrenzen)
  const extend = 5000;
  const ux = dx / len, uy = dy / len;
  const cx = (ref.x1 + ref.x2) / 2 + nx * distancePx * side;
  const cy = (ref.y1 + ref.y2) / 2 + ny * distancePx * side;

  const guideLine = new fabric.Line(
    [cx - ux * extend, cy - uy * extend, cx + ux * extend, cy + uy * extend],
    {
      stroke: PARALLEL_COLOR, strokeWidth: 1,
      strokeDashArray: [8, 4], opacity: 0.7,
      selectable: false, evented: false, _noSelect: true,
    }
  );
  canvas.add(guideLine);
  _parallelGuideObjs.push(guideLine);

  // Senkrechte Linie von Snap-Punkt zur Referenzlinie
  const projOnRef = projectPointOnLine(snapped, ref);
  const perpLine = new fabric.Line(
    [snapped.x, snapped.y, projOnRef.point.x, projOnRef.point.y],
    {
      stroke: PARALLEL_COLOR, strokeWidth: 0.7,
      strokeDashArray: [3, 2], opacity: 0.8,
      selectable: false, evented: false, _noSelect: true,
    }
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
    fill: PARALLEL_COLOR,
    backgroundColor: 'rgba(255,255,255,0.9)', padding: 1,
    originX: 'center', originY: 'center',
    selectable: false, evented: false, _noSelect: true,
  });
  canvas.add(txt);
  _parallelGuideObjs.push(txt);
}

export function activateParallelSnap(refId, distanceM) {
  const distancePx = distanceM * state.scale * state.imgDisplayScale;
  state.parallelSnap = { refId, distancePx, distanceM };
  const ref = state.pipeReferences.find(r => r.id === refId);
  const name = ref ? ref.name : '';
  document.getElementById('status-hint').textContent =
    `Parallel zu "${name}": ${distanceM} m – Klick = Punkt setzen`;
  const btn = document.getElementById('btn-parallel-snap');
  if (btn) btn.classList.add('active');
}

export function deactivateParallelSnap() {
  state.parallelSnap = null;
  clearParallelGuides();
  const btn = document.getElementById('btn-parallel-snap');
  if (btn) btn.classList.remove('active');
}

export function showParallelSnapModal() {
  // Wenn schon aktiv → deaktivieren
  if (state.parallelSnap) {
    deactivateParallelSnap();
    return;
  }

  if (!state.scale) {
    showToast('Bitte zuerst Maßstab setzen!', 'warning');
    return;
  }

  const lineRefs = state.pipeReferences.filter(r => r.type === 'line');
  if (lineRefs.length === 0) {
    showToast('Keine Hilfslinien vorhanden – zuerst eine erstellen.', 'warning');
    return;
  }

  const options = lineRefs.map(r =>
    `<option value="${r.id}">${r.name}</option>`
  ).join('');

  createModal('Parallel zeichnen',
    `<div style="display:flex;flex-direction:column;gap:10px;">
      <label style="font-size:12px;color:#555;">Hilfslinie</label>
      <select id="parallel-ref-select" style="width:100%;padding:6px;border-radius:6px;border:1px solid #d1d5db;">${options}</select>
      <label style="font-size:12px;color:#555;">Abstand (Meter)</label>
      <input type="number" id="parallel-dist-input" placeholder="z.B. 0.60" min="0.01" step="0.01" style="width:100%;padding:6px;border-radius:6px;border:1px solid #d1d5db;" />
    </div>`,
    () => {
      const refId = parseInt(document.getElementById('parallel-ref-select').value);
      const dist = parseFloat(document.getElementById('parallel-dist-input').value);
      if (isNaN(dist) || dist <= 0) {
        showToast('Bitte gültigen Abstand eingeben.', 'warning');
        return;
      }
      activateParallelSnap(refId, dist);
    }
  );
  setTimeout(() => document.getElementById('parallel-dist-input')?.focus(), 80);
}

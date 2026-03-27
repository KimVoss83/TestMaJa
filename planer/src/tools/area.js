import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { nextMeasureId } from '../state.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, polygonArea, formatArea } from '../utils/helpers.js';
import { haptic, showMeasurementToast } from '../ui/modals.js';
import { TOOL_HINTS, callHook } from './tool-manager.js';

// =========================================================
// AREA TOOL
// =========================================================
export function handleAreaClick(p) {
  state.areaPoints.push(p);
  document.getElementById('status-hint').textContent =
    `${state.areaPoints.length} Punkt(e) gesetzt – Doppelklick zum Abschluss`;
}

export function updatePreviewPolygon(pts) {
  if (state.drawingPolygon) canvas.remove(state.drawingPolygon);
  if (pts.length < 2) return;
  state.drawingPolygon = new fabric.Polyline(pts.map(p => ({ x: p.x, y: p.y })), {
    fill: state.color + '22', stroke: state.color, strokeWidth: state.lineWidth,
    strokeDashArray: [5, 4],
    selectable: false, evented: false, _noSelect: true,
  });
  canvas.add(state.drawingPolygon);
  canvas.renderAll();
}

export function finishArea() {
  if (state.drawingPolygon) { canvas.remove(state.drawingPolygon); state.drawingPolygon = null; }
  const pts = state.areaPoints.slice();
  if (pts.length < 3) { state.areaPoints = []; return; }

  const pxArea = polygonArea(pts) / (state.imgDisplayScale ** 2);
  const m2 = state.scale ? pxArea / (state.scale ** 2) : null;
  const areaErrPct = callHook('areaRelErr_pct', m2, pts.length);
  const labelText = m2
    ? formatArea(m2)
    : `${Math.round(pxArea)} px²`;

  const id = nextMeasureId();
  const poly = new fabric.Polygon(pts.map(p => ({ x: p.x, y: p.y })), {
    fill: state.color + '33', stroke: state.color, strokeWidth: state.lineWidth,
    selectable: true, evented: true, _measureId: id,
    lockMovementX: true, lockMovementY: true,
  });

  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  canvas.add(poly);
  addLabel(cx, cy, labelText, state.color, id);
  canvas.renderAll();

  state.measurements.push({ id, type: 'area', label: labelText, value: m2 });
  callHook('updateMeasurementList');
  state.areaPoints = [];
  saveSnapshot();
  document.getElementById('status-hint').textContent = TOOL_HINTS['area'];
  haptic('medium');
  showMeasurementToast(labelText);
}

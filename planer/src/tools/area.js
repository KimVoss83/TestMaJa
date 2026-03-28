import { state, nextMeasureId } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, polygonArea, formatArea } from '../utils/helpers.js';
import { haptic, showMeasurementToast } from '../ui/modals.js';
import { TOOL_HINTS, callHook } from './tool-manager.js';

// =========================================================
// AREA TOOL
// =========================================================

// 90° snapping state
let _areaSnap90 = false;
export function setAreaSnap90(v) { _areaSnap90 = v; }
export function getAreaSnap90() { return _areaSnap90; }

// Snap point to 90° relative to the previous edge direction
export function snap90(p, pts) {
  if (!_areaSnap90 || pts.length < 1) return p;
  const prev = pts[pts.length - 1];
  const dx = p.x - prev.x;
  const dy = p.y - prev.y;

  if (pts.length < 2) {
    // Only one point so far: snap to horizontal or vertical from it
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: p.x, y: prev.y };
    } else {
      return { x: prev.x, y: p.y };
    }
  }

  // Two or more points: constrain perpendicular or parallel to previous edge
  const prev2 = pts[pts.length - 2];
  const edgeDx = prev.x - prev2.x;
  const edgeDy = prev.y - prev2.y;
  const edgeLen = Math.hypot(edgeDx, edgeDy);
  if (edgeLen < 1e-6) {
    // Degenerate edge, fall back to axis-aligned
    if (Math.abs(dx) >= Math.abs(dy)) return { x: p.x, y: prev.y };
    return { x: prev.x, y: p.y };
  }

  // Unit vectors: along edge and perpendicular
  const ux = edgeDx / edgeLen, uy = edgeDy / edgeLen;
  const px = -uy, py = ux; // perpendicular

  // Project delta onto both directions, pick the one cursor is closer to
  const projParallel = dx * ux + dy * uy;
  const projPerp = dx * px + dy * py;

  if (Math.abs(projParallel) >= Math.abs(projPerp)) {
    // Snap along the edge direction (parallel)
    return { x: prev.x + projParallel * ux, y: prev.y + projParallel * uy };
  } else {
    // Snap perpendicular
    return { x: prev.x + projPerp * px, y: prev.y + projPerp * py };
  }
}

export function handleAreaClick(p) {
  const snapped = snap90(p, state.areaPoints);
  state.areaPoints.push(snapped);
  document.getElementById('status-hint').textContent =
    `${state.areaPoints.length} Punkt(e) gesetzt – Doppelklick zum Abschluss`;
}

export function updatePreviewPolygon(pts) {
  if (state.drawingPolygon) canvas.remove(state.drawingPolygon);
  if (pts.length < 2) return;
  // Apply 90° snap to the cursor point (last element)
  const snappedPts = pts.slice(0, -1).concat(snap90(pts[pts.length - 1], pts.slice(0, -1)));
  state.drawingPolygon = new fabric.Polyline(snappedPts.map(p => ({ x: p.x, y: p.y })), {
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
    hasControls: false, hasBorders: false,
    lockScalingX: true, lockScalingY: true, lockRotation: true,
  });

  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  canvas.add(poly);
  const label = addLabel(cx, cy, labelText, state.color, id);
  canvas.renderAll();

  state.measurements.push({ id, type: 'area', label: labelText, value: m2 });
  callHook('updateMeasurementList');
  state.areaPoints = [];
  saveSnapshot();
  document.getElementById('status-hint').textContent = TOOL_HINTS['area'];
  haptic('medium');
  showMeasurementToast(labelText);
}

// =========================================================
// AREA EDIT MODE — drag polygon vertices, live area update
// =========================================================
const AREA_HANDLE_RADIUS = 4;

export function startAreaEdit(polygon) {
  endAreaEdit();
  if (!polygon || polygon._measureId == null) return;

  const id = polygon._measureId;
  const pts = polygon.points;
  const handles = [];

  const matrix = polygon.calcTransformMatrix();

  pts.forEach((pt, idx) => {
    const abs = fabric.util.transformPoint(
      new fabric.Point(pt.x - polygon.pathOffset.x, pt.y - polygon.pathOffset.y), matrix
    );
    const handle = new fabric.Circle({
      left: abs.x, top: abs.y,
      radius: AREA_HANDLE_RADIUS,
      fill: '#ffffff', stroke: polygon.stroke || state.color,
      strokeWidth: 1.5,
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      hasControls: false, hasBorders: false,
      _areaHandle: true, _areaHandleIdx: idx, _areaHandleMeasureId: id,
    });
    canvas.add(handle);
    handles.push(handle);
  });

  state.editingArea = { id, polygon, handles };

  polygon.selectable = false;
  polygon.evented = false;

  canvas.renderAll();
  document.getElementById('status-hint').textContent =
    'Eckpunkte ziehen zum Bearbeiten · Esc = Bearbeitung beenden';
}

export function endAreaEdit() {
  if (!state.editingArea) return;
  const { handles, polygon } = state.editingArea;
  handles.forEach(h => canvas.remove(h));
  if (polygon) {
    polygon.selectable = true;
    polygon.evented = true;
  }
  state.editingArea = null;
  canvas.renderAll();
}

export function updateAreaFromHandles() {
  const ea = state.editingArea;
  if (!ea) return;
  const { polygon, handles, id } = ea;

  const newPts = handles.map(h => ({ x: h.left, y: h.top }));
  const color = polygon.stroke || state.color;
  const lineWidth = polygon.strokeWidth || state.lineWidth;

  // Remove old polygon
  canvas.remove(polygon);

  // Create new polygon
  const newPoly = new fabric.Polygon(newPts.map(p => ({ x: p.x, y: p.y })), {
    fill: color + '33', stroke: color, strokeWidth: lineWidth,
    selectable: false, evented: false, _measureId: id,
    lockMovementX: true, lockMovementY: true,
    hasControls: false, hasBorders: false,
    lockScalingX: true, lockScalingY: true, lockRotation: true,
  });
  canvas.add(newPoly);
  // Send polygon behind handles
  canvas.sendToBack(newPoly);
  // Also send background image behind everything
  const bg = canvas.getObjects().find(o => o._isBackground);
  if (bg) canvas.sendToBack(bg);

  ea.polygon = newPoly;

  // Recalculate area
  const pxArea = polygonArea(newPts) / (state.imgDisplayScale ** 2);
  const m2 = state.scale ? pxArea / (state.scale ** 2) : null;
  const labelText = m2 ? formatArea(m2) : `${Math.round(pxArea)} px²`;

  // Update label
  const labelObj = canvas.getObjects().find(o => o._measureId === id && o.type === 'text');
  if (labelObj) {
    const cx = newPts.reduce((s, p) => s + p.x, 0) / newPts.length;
    const cy = newPts.reduce((s, p) => s + p.y, 0) / newPts.length;
    labelObj.set({ text: labelText, left: cx, top: cy });
    labelObj.setCoords();
  }

  // Update measurement in state
  const meas = state.measurements.find(m => m.id === id);
  if (meas) {
    meas.label = labelText;
    meas.value = m2;
  }
  callHook('updateMeasurementList');

  canvas.renderAll();
}

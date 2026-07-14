import { state, nextMeasureId } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, addEndpointDot, addTickMarks, ptDist, formatDistance } from '../utils/helpers.js';
import { haptic, showMeasurementToast } from '../ui/modals.js';
import { TOOL_HINTS, callHook } from './tool-manager.js';

// =========================================================
// DISTANCE TOOL
// =========================================================
export function handleDistanceClick(p) {
  if (state.distPoints.length === 0) {
    state.distPoints = [p];
    document.getElementById('status-hint').textContent = 'Endpunkt klicken …';
    // Start dot
    addEndpointDot(p.x, p.y, state.color, -1); // temp dot id -1
    state.drawingLine = new fabric.Line([p.x, p.y, p.x, p.y], {
      stroke: state.color, strokeWidth: state.lineWidth,
      selectable: false, evented: false, _noSelect: true, _tempDraw: true,
    });
    canvas.add(state.drawingLine);
  } else {
    finishDistance(p);
    document.getElementById('status-hint').textContent = TOOL_HINTS['distance'];
  }
}

export function finishDistance(p2) {
  callHook('removeLiveLabel');
  const p1 = state.distPoints[0];
  const pxDist = ptDist(p1.x, p1.y, p2.x, p2.y) / state.imgDisplayScale;
  const meters = state.scale ? pxDist / state.scale : null;
  const errM = callHook('distErr_m', meters);
  const labelText = meters
    ? formatDistance(meters)
    : `${Math.round(pxDist)} px`;

  // Remove temp objects
  canvas.getObjects().filter(o => o._tempDraw).forEach(o => canvas.remove(o));
  if (state.drawingLine) { canvas.remove(state.drawingLine); state.drawingLine = null; }

  const id = nextMeasureId();
  const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
    stroke: state.color, strokeWidth: state.lineWidth,
    selectable: true, evented: true, _measureId: id,
    lockMovementX: true, lockMovementY: true,
    hasControls: false, hasBorders: false,
    lockScalingX: true, lockScalingY: true, lockRotation: true,
  });

  canvas.add(line);
  addEndpointDot(p1.x, p1.y, state.color, id);
  addEndpointDot(p2.x, p2.y, state.color, id);
  addTickMarks(line, state.color, id);

  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const offX = -Math.sin(angle) * 14;
  const offY =  Math.cos(angle) * 14;
  const txt = addLabel(mx + offX, my + offY, labelText, state.color, id);

  canvas.renderAll();
  state.measurements.push({ id, type: 'distance', label: labelText, value: meters });
  callHook('updateMeasurementList');
  state.distPoints = [];
  saveSnapshot();
  haptic('medium');
  showMeasurementToast(labelText);
}

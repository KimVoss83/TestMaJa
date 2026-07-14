import { state, nextMeasureId } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, addEndpointDot, ptDist, formatDistance, formatArea } from '../utils/helpers.js';
import { haptic, showMeasurementToast } from '../ui/modals.js';
import { TOOL_HINTS, callHook } from './tool-manager.js';

// =========================================================
// CIRCLE TOOL
// =========================================================
export function handleCircleClick(p) {
  if (!state.circleCenter) {
    state.circleCenter = p;
    document.getElementById('status-hint').textContent = 'Radius klicken …';
  } else {
    finishCircle(p);
    document.getElementById('status-hint').textContent = TOOL_HINTS['circle'];
  }
}

export function updatePreviewCircle(center, r, edgePt) {
  canvas.getObjects().filter(o => o._circlePreview).forEach(o => canvas.remove(o));
  if (r < 2) return;

  const circ = new fabric.Circle({
    left: center.x - r, top: center.y - r, radius: r,
    fill: state.color + '22', stroke: state.color, strokeWidth: state.lineWidth, strokeDashArray: [5, 4],
    selectable: false, evented: false, _circlePreview: true, _noSelect: true,
  });
  const radiusLine = new fabric.Line([center.x, center.y, edgePt.x, edgePt.y], {
    stroke: state.color, strokeWidth: 1, strokeDashArray: [4, 3],
    selectable: false, evented: false, _circlePreview: true, _noSelect: true,
  });
  canvas.add(circ, radiusLine);
  canvas.renderAll();
}

export function finishCircle(edgePt) {
  callHook('removeLiveLabel');
  canvas.getObjects().filter(o => o._circlePreview).forEach(o => canvas.remove(o));
  const center = state.circleCenter;
  state.circleCenter = null;

  const r = ptDist(center.x, center.y, edgePt.x, edgePt.y);
  const rOrig = r / state.imgDisplayScale;
  const rMeters = state.scale ? rOrig / state.scale : null;
  const m2 = rMeters ? Math.PI * rMeters * rMeters : null;

  const rErrM = callHook('distErr_m', rMeters);
  const aErrPct = callHook('areaRelErr_pct', m2, 1);
  const rLabel = rMeters
    ? `r = ${formatDistance(rMeters)}`
    : `r = ${Math.round(r)} px`;
  const aLabel = m2
    ? `A = ${formatArea(m2)}`
    : `A = ${Math.round(Math.PI * r * r)} px²`;

  const id = nextMeasureId();

  const circ = new fabric.Circle({
    left: center.x - r, top: center.y - r, radius: r,
    fill: state.color + '26', stroke: state.color, strokeWidth: state.lineWidth,
    selectable: true, evented: true, _measureId: id,
    lockMovementX: true, lockMovementY: true,
    hasControls: false, hasBorders: false,
    lockScalingX: true, lockScalingY: true, lockRotation: true,
  });

  // Radius line from center to right edge (horizontal)
  const radiusLine = new fabric.Line([center.x, center.y, center.x + r, center.y], {
    stroke: state.color, strokeWidth: 1.5, strokeDashArray: [5, 3],
    selectable: false, evented: false, _measureId: id,
  });

  // Center dot + edge dot – gleiche Größe wie Distanzpunkte
  const centerDot = addEndpointDot(center.x, center.y, state.color, id);
  const edgeDot   = addEndpointDot(center.x + r, center.y, state.color, id);

  canvas.add(circ, radiusLine);

  // Radius label (middle of radius line)
  addLabel(center.x + r / 2, center.y - 10, rLabel, state.color, id);
  // Area label (center of circle)
  addLabel(center.x, center.y + 10, aLabel, state.color, id);

  canvas.renderAll();

  const combinedLabel = `${rLabel} | ${aLabel}`;
  state.measurements.push({ id, type: 'circle', label: combinedLabel, value: m2, rMeters });
  callHook('updateMeasurementList');
  saveSnapshot();
  haptic('medium');
  showMeasurementToast(rLabel);
}

import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { nextMeasureId } from '../state.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, addEndpointDot, ptDist, formatDistance, formatArea } from '../utils/helpers.js';
import { TOOL_HINTS, callHook } from './tool-manager.js';

// =========================================================
// ARC / SECTOR TOOL
// =========================================================
export function handleArcClick(p) {
  if (state.arcStep === 0) {
    state.arcCenter = p;
    state.arcStep = 1;
    // Center dot preview
    const dot = new fabric.Circle({
      left: p.x, top: p.y, radius: 5, fill: state.color, stroke: '#fff', strokeWidth: 1,
      originX: 'center', originY: 'center',
      selectable: false, evented: false, _arcPreview: true, _noSelect: true,
    });
    canvas.add(dot);
    canvas.renderAll();
    document.getElementById('status-hint').textContent = 'Startwinkel-Punkt klicken …';
  } else if (state.arcStep === 1) {
    state.arcStartPt = p;
    state.arcStep = 2;
    document.getElementById('status-hint').textContent = 'Endwinkel-Punkt klicken (oder Doppelklick)';
  } else if (state.arcStep === 2) {
    finishArc(p);
  }
}

export function updatePreviewArc(cursor) {
  canvas.getObjects().filter(o => o._arcPreview && !o._arcCenterDot).forEach(o => canvas.remove(o));
  const c = state.arcCenter;
  if (!c) return;

  if (state.arcStep === 1) {
    // Show line from center to cursor
    const line = new fabric.Line([c.x, c.y, cursor.x, cursor.y], {
      stroke: state.color, strokeWidth: 1, strokeDashArray: [4, 3],
      selectable: false, evented: false, _arcPreview: true, _noSelect: true,
    });
    canvas.add(line);
  } else if (state.arcStep === 2 && state.arcStartPt) {
    const r = ptDist(c.x, c.y, state.arcStartPt.x, state.arcStartPt.y);
    const startAngle = Math.atan2(state.arcStartPt.y - c.y, state.arcStartPt.x - c.x);
    const endAngle = Math.atan2(cursor.y - c.y, cursor.x - c.x);
    const sweep = arcSweepDir(c, state.arcStartPt, cursor);
    const pathEl = buildSectorPath(c, r, startAngle, endAngle, state.color, undefined, sweep);
    pathEl._arcPreview = true; pathEl._noSelect = true;

    const line1 = new fabric.Line([c.x, c.y, state.arcStartPt.x, state.arcStartPt.y], {
      stroke: state.color, strokeWidth: state.lineWidth,
      selectable: false, evented: false, _arcPreview: true, _noSelect: true,
    });
    const line2 = new fabric.Line([c.x, c.y, cursor.x, cursor.y], {
      stroke: state.color, strokeWidth: state.lineWidth, strokeDashArray: [4, 3],
      selectable: false, evented: false, _arcPreview: true, _noSelect: true,
    });
    canvas.add(pathEl, line1, line2);
  }
  canvas.renderAll();
}

// Gibt 1 (CW) oder 0 (CCW) zurück, je nachdem auf welcher Seite der cursor liegt
export function arcSweepDir(center, startPt, cursorPt) {
  const cross = (startPt.x - center.x) * (cursorPt.y - center.y)
              - (startPt.y - center.y) * (cursorPt.x - center.x);
  return cross >= 0 ? 1 : 0;
}

export function buildSectorPath(center, r, startAngle, endAngle, color, sw, sweep = 1) {
  const sx = center.x + r * Math.cos(startAngle);
  const sy = center.y + r * Math.sin(startAngle);
  const ex = center.x + r * Math.cos(endAngle);
  const ey = center.y + r * Math.sin(endAngle);
  let diff = sweep === 1
    ? (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI)
    : (startAngle - endAngle + 2 * Math.PI) % (2 * Math.PI);
  if (diff === 0) diff = 2 * Math.PI;
  const large = diff > Math.PI ? 1 : 0;
  const d = `M ${center.x} ${center.y} L ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey} Z`;
  return new fabric.Path(d, {
    fill: color + '33', stroke: color, strokeWidth: sw ?? state.lineWidth,
    selectable: true, evented: true,
    lockMovementX: true, lockMovementY: true,
  });
}

export function finishArc(endPt) {
  canvas.getObjects().filter(o => o._arcPreview).forEach(o => canvas.remove(o));

  const c = state.arcCenter;
  const sp = state.arcStartPt;
  const r = ptDist(c.x, c.y, sp.x, sp.y);
  const startAngle = Math.atan2(sp.y - c.y, sp.x - c.x);
  const endAngle   = Math.atan2(endPt.y - c.y, endPt.x - c.x);
  const sweep      = arcSweepDir(c, sp, endPt);

  let diff = sweep === 1
    ? (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI)
    : (startAngle - endAngle + 2 * Math.PI) % (2 * Math.PI);
  if (diff === 0) diff = 2 * Math.PI;

  const rOrig       = r / state.imgDisplayScale;
  const rMeters     = state.scale ? rOrig / state.scale : null;
  const arcLen      = rOrig * diff;
  const arcLenM     = state.scale ? arcLen / state.scale : null;
  const sectorArea  = 0.5 * rOrig * rOrig * diff;
  const sectorAreaM = state.scale ? sectorArea / (state.scale ** 2) : null;
  const angleDeg    = (diff * 180 / Math.PI).toFixed(1);

  const rErrM_arc      = callHook('distErr_m', rMeters);
  const arcErrM        = callHook('distErr_m', arcLenM);
  const aErrPct_arc    = callHook('areaRelErr_pct', sectorAreaM, 2);
  const rLabel    = rMeters     ? `r=${formatDistance(rMeters)}`           : `r=${Math.round(r)}px`;
  const arcLabel  = arcLenM     ? `Bogen: ${formatDistance(arcLenM)}`      : `Bogen: ${Math.round(arcLen)}px`;
  const aLabel    = sectorAreaM ? `A=${formatArea(sectorAreaM)}`            : `A=${Math.round(sectorArea)}px²`;
  const fullLabel = `${angleDeg}° | ${rLabel} | ${aLabel}`;

  const id = nextMeasureId();

  const sector = buildSectorPath(c, r, startAngle, endAngle, state.color, undefined, sweep);
  sector._measureId = id;

  // Lines (Schenkel)
  const line1 = new fabric.Line([c.x, c.y, sp.x, sp.y], {
    stroke: state.color, strokeWidth: state.lineWidth,
    selectable: false, evented: false, _measureId: id,
  });
  const line2 = new fabric.Line([c.x, c.y, endPt.x, endPt.y], {
    stroke: state.color, strokeWidth: state.lineWidth,
    selectable: false, evented: false, _measureId: id,
  });

  canvas.add(sector, line1, line2);

  // Endpoint dots – gleiche Größe wie Distanzpunkte
  addEndpointDot(c.x,      c.y,      state.color, id);
  addEndpointDot(sp.x,     sp.y,     state.color, id);
  addEndpointDot(endPt.x,  endPt.y,  state.color, id);

  // Labels
  const midAngle = startAngle + diff / 2;
  const labelR = r * 0.55;
  const lx = c.x + labelR * Math.cos(midAngle);
  const ly = c.y + labelR * Math.sin(midAngle);
  addLabel(lx, ly, `${angleDeg}°`, state.color, id);
  addLabel(lx, ly + state.fontSize + 4, aLabel, state.color, id);

  // Arc bogen label on arc midpoint
  const arcMidX = c.x + r * Math.cos(midAngle);
  const arcMidY = c.y + r * Math.sin(midAngle);
  addLabel(arcMidX, arcMidY - 10, arcLabel, state.color, id);

  canvas.renderAll();
  state.measurements.push({ id, type: 'arc', label: fullLabel, value: sectorAreaM });
  callHook('updateMeasurementList');
  saveSnapshot();

  // Reset arc state
  state.arcStep = 0;
  state.arcCenter = null;
  state.arcStartPt = null;
  document.getElementById('status-hint').textContent = TOOL_HINTS['arc'];
}

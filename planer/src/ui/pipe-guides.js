import { state, TOUCH_SCALE } from '../state.js';
import { canvas, _safeHandler } from '../canvas.js';
import { closestPointOnSegment, projectPointOnLine, formatDistance } from '../utils/helpers.js';
import { PIPE_REF_GUIDE_COLOR } from '../tools/pipe-refs.js';
import { saveSnapshot } from '../undo.js';

// =========================================================
// PIPE DISTANCE GUIDES — distances to active references
// =========================================================
export function clearPipeDistanceGuides() {
  state.pipeSnapLines.forEach(o => canvas.remove(o));
  state.pipeSnapLines = [];
}

export function showPipeDistanceGuides(cursorPt) {
  clearPipeDistanceGuides();
  if (!cursorPt || state.activePipeRefs.length === 0) return;

  const guides = [];

  state.activePipeRefs.forEach(refId => {
    const ref = state.pipeReferences.find(r => r.id === refId);
    if (!ref) return;

    let closestPt, dist;

    if (ref.type === 'line') {
      // Perpendicular distance to line
      const proj = projectPointOnLine(cursorPt, ref);
      closestPt = proj.point;
      dist = proj.dist;
    } else {
      // Direct distance to point
      closestPt = { x: ref.x, y: ref.y };
      dist = Math.hypot(cursorPt.x - ref.x, cursorPt.y - ref.y);
    }

    if (dist < 1) return;

    // Distance in meters
    const pxDist = dist / state.imgDisplayScale;
    const meters = state.scale ? pxDist / state.scale : null;
    const label = meters ? formatDistance(meters) : `${Math.round(pxDist)} px`;

    // Guide line (perpendicular for lines, direct for points)
    const guideLine = new fabric.Line([closestPt.x, closestPt.y, cursorPt.x, cursorPt.y], {
      stroke: PIPE_REF_GUIDE_COLOR, strokeWidth: 0.7,
      strokeDashArray: [3, 2],
      selectable: false, evented: false, _pipeGuide: true, _noSelect: true,
    });
    canvas.add(guideLine);
    guides.push(guideLine);

    // Small square at projection point
    const sq = new fabric.Rect({
      left: closestPt.x - 1.5, top: closestPt.y - 1.5, width: 3, height: 3,
      fill: PIPE_REF_GUIDE_COLOR, stroke: 'none',
      selectable: false, evented: false, _pipeGuide: true, _noSelect: true,
    });
    canvas.add(sq);
    guides.push(sq);

    // Distance label
    const mx = (closestPt.x + cursorPt.x) / 2;
    const my = (closestPt.y + cursorPt.y) / 2;
    const angle = Math.atan2(cursorPt.y - closestPt.y, cursorPt.x - closestPt.x);
    const lOffX = -Math.sin(angle) * 5, lOffY = Math.cos(angle) * 5;
    const txt = new fabric.Text(`${ref.name}: ${label}`, {
      left: mx + lOffX, top: my + lOffY,
      fontSize: 6,
      fill: 'rgba(255,59,48,0.9)',
      fontFamily: 'monospace', fontWeight: 'bold',
      backgroundColor: 'rgba(255,255,255,0.88)',
      padding: 1,
      originX: 'center', originY: 'center',
      selectable: false, evented: false, _pipeGuide: true, _noSelect: true,
    });
    canvas.add(txt);
    guides.push(txt);
  });

  state.pipeSnapLines = guides;
}


// Kürzester Abstand zwischen zwei Segmenten (beide geclampt)
// Gibt { footA, footB, dist } zurück
function segmentToSegmentClosest(a1, a2, b1, b2) {
  const candidates = [
    { fA: closestPointOnSegment(b1, a1, a2), fB: b1 },
    { fA: closestPointOnSegment(b2, a1, a2), fB: b2 },
    { fA: a1, fB: closestPointOnSegment(a1, b1, b2) },
    { fA: a2, fB: closestPointOnSegment(a2, b1, b2) },
  ];
  let best = null;
  for (const c of candidates) {
    const d = Math.hypot(c.fA.x - c.fB.x, c.fA.y - c.fB.y);
    if (!best || d < best.dist) best = { footA: c.fA, footB: c.fB, dist: d };
  }
  return best;
}

// ─── Maßlinien: Berechnung ────────────────────────────────
// Gibt { footOnRef, footOnPipe, dist_m, t } oder null zurück
// overrideT: optionaler Parameter t (Position auf Hilfslinie), wenn vom Nutzer gesetzt
export function computeDimLine(pipePolyline, ref, overrideT) {
  if (!pipePolyline || !ref) return null;

  // Hole absolute Canvas-Punkte der Pipe-Polylinie
  const matrix = pipePolyline.calcTransformMatrix();
  const absPts = pipePolyline.points.map(pt =>
    fabric.util.transformPoint(
      new fabric.Point(pt.x - pipePolyline.pathOffset.x, pt.y - pipePolyline.pathOffset.y),
      matrix
    )
  );

  let bestFootOnRef = null, bestFootOnPipe = null, bestDist = Infinity;

  if (ref.type === 'line' && overrideT != null) {
    // Nutzer hat Fußpunkt auf Hilfslinie manuell gewählt (Parameter t)
    const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
    bestFootOnRef = { x: ref.x1 + overrideT * dx, y: ref.y1 + overrideT * dy };
    // Lot vom gewählten Ref-Punkt auf nächstes Pipe-Segment
    for (let i = 0; i < absPts.length - 1; i++) {
      const fp = closestPointOnSegment(bestFootOnRef, absPts[i], absPts[i + 1]);
      const d = Math.hypot(bestFootOnRef.x - fp.x, bestFootOnRef.y - fp.y);
      if (d < bestDist) { bestDist = d; bestFootOnPipe = fp; }
    }
  } else {
    for (let i = 0; i < absPts.length - 1; i++) {
      const a1 = absPts[i], a2 = absPts[i + 1];

      let footRef, footPipe, dist;
      if (ref.type === 'line') {
        const r = segmentToSegmentClosest(
          { x: ref.x1, y: ref.y1 }, { x: ref.x2, y: ref.y2 },
          a1, a2
        );
        footRef = r.footA; footPipe = r.footB; dist = r.dist;
      } else {
        // RefPoint: Lot vom Punkt auf Pipe-Segment
        footRef = { x: ref.x, y: ref.y };
        footPipe = closestPointOnSegment({ x: ref.x, y: ref.y }, a1, a2);
        dist = Math.hypot(footRef.x - footPipe.x, footRef.y - footPipe.y);
      }

      if (dist < bestDist) {
        bestDist = dist; bestFootOnRef = footRef; bestFootOnPipe = footPipe;
      }
    }
  }

  if (bestDist < 1 || !bestFootOnRef) return null;

  // t-Wert für Hilfslinie berechnen (für Persistenz)
  let tOnRef = overrideT;
  if (tOnRef == null && ref.type === 'line') {
    const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
    const lenSq = dx * dx + dy * dy;
    tOnRef = lenSq > 1e-9
      ? ((bestFootOnRef.x - ref.x1) * dx + (bestFootOnRef.y - ref.y1) * dy) / lenSq
      : 0;
  }

  // Umrechnung in Meter (imgDisplayScale kompensieren)
  const pxDist = bestDist / (state.imgDisplayScale || 1);
  const dist_m = state.scale ? pxDist / state.scale : null;

  return { footOnRef: bestFootOnRef, footOnPipe: bestFootOnPipe, dist_m, t: tOnRef };
}

const DIM_COLOR  = '#FFD700';
const DIM_WIDTH  = 1.5;

export function clearDimLinesForPipe(measureId) {
  canvas.getObjects()
    .filter(o => o._dimLinePipeId === measureId)
    .forEach(o => canvas.remove(o));
}

export function renderDimLinesForPipe(measureId) {
  clearDimLinesForPipe(measureId);

  const meas = state.measurements.find(m => m.id === measureId);
  if (!meas || !meas.refs || meas.refs.length === 0) return;

  const polyline = canvas.getObjects().find(
    o => o._measureId === measureId && o.type === 'polyline' && !o._pipePreview
  );
  if (!polyline) return;

  if (!meas.dimFootOverrides) meas.dimFootOverrides = {};

  const dimObjs = [];

  meas.refs.forEach(refId => {
    const ref = state.pipeReferences.find(r => r.id === refId);
    if (!ref) return;

    const override = meas.dimFootOverrides[refId];
    const overrideT = (ref.type === 'line' && override != null) ? override.t : undefined;
    const result = computeDimLine(polyline, ref, overrideT);
    if (!result) return;

    const { footOnRef, footOnPipe, dist_m, t: computedT } = result;
    const isPoint = ref.type === 'point';

    // Linienstärke und Größen analog zu anderen Maßen
    const lw = (state.lineWidth || DIM_WIDTH) * TOUCH_SCALE;

    // Hauptlinie
    const line = new fabric.Line(
      [footOnRef.x, footOnRef.y, footOnPipe.x, footOnPipe.y],
      {
        stroke: DIM_COLOR, strokeWidth: lw,
        strokeDashArray: isPoint ? [5, 3] : undefined,
        opacity: isPoint ? 0.75 : 1,
        selectable: false, evented: false, _noSelect: true,
        _dimLinePipeId: measureId,
      }
    );
    dimObjs.push(line);

    // Fußpunkt auf Referenz: gefüllter Kreis orange — bei Hilfslinien verschiebbar
    const isLineRef = ref.type === 'line';
    const dotRadius = isLineRef ? Math.max(5, lw * 3.5) : Math.max(3, lw * 2.5);
    const dotRef = new fabric.Circle({
      left: footOnRef.x, top: footOnRef.y, radius: dotRadius,
      fill: '#FF9800', stroke: isLineRef ? '#E65100' : 'none',
      strokeWidth: isLineRef ? 1.5 : 0,
      originX: 'center', originY: 'center',
      selectable: isLineRef, evented: isLineRef,
      hasControls: false, hasBorders: false,
      hoverCursor: isLineRef ? 'grab' : 'default',
      moveCursor: isLineRef ? 'grabbing' : 'default',
      _noSelect: !isLineRef,
      _dimLinePipeId: measureId,
      _dimDraggableFoot: isLineRef,
      _dimRefId: refId,
      _dimMeasureId: measureId,
    });
    dimObjs.push(dotRef);

    // Fußpunkt auf Rohr: ungefüllter Kreis gold
    const dotPipe = new fabric.Circle({
      left: footOnPipe.x, top: footOnPipe.y, radius: Math.max(2, lw * 2),
      fill: 'transparent', stroke: DIM_COLOR, strokeWidth: lw,
      originX: 'center', originY: 'center',
      selectable: false, evented: false, _noSelect: true,
      _dimLinePipeId: measureId,
    });
    dimObjs.push(dotPipe);

    // Pfeilspitzen (Dreiecke an beiden Enden)
    const angle = Math.atan2(footOnPipe.y - footOnRef.y, footOnPipe.x - footOnRef.x);
    [[footOnPipe, angle + Math.PI], [footOnRef, angle]].forEach(([tip, ang]) => {
      const L = Math.max(7, lw * 6), B = Math.max(2, lw * 2);
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const p1 = { x: tip.x + L * cos + B * (-sin), y: tip.y + L * sin + B * cos };
      const p2 = { x: tip.x + L * cos - B * (-sin), y: tip.y + L * sin - B * cos };
      const arrow = new fabric.Polygon(
        [{ x: tip.x, y: tip.y }, p1, p2],
        { fill: DIM_COLOR, stroke: 'none',
          selectable: false, evented: false, _noSelect: true,
          _dimLinePipeId: measureId }
      );
      dimObjs.push(arrow);
    });

    // Maßzahl-Label
    const mx = (footOnRef.x + footOnPipe.x) / 2;
    const my = (footOnRef.y + footOnPipe.y) / 2;
    const distLabel = dist_m != null ? dist_m.toFixed(2) + ' m' : '? m';

    // Seitenauswahl: Seite näher zur Canvas-Mitte
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const nx = -(footOnPipe.y - footOnRef.y), ny = (footOnPipe.x - footOnRef.x);
    const nLen = Math.hypot(nx, ny) || 1;
    const n = { x: nx / nLen, y: ny / nLen };
    const fs = state.fontSize || 11;
    const OFFSET = Math.max(12, fs * 1.1);
    const dot = (v) => v.x * (cx - mx) / (Math.hypot(cx - mx, cy - my) || 1)
                     + v.y * (cy - my) / (Math.hypot(cx - mx, cy - my) || 1);
    const side = (dot(n) >= dot({ x: -n.x, y: -n.y })) ? 1 : -1;
    let lx = mx + side * n.x * OFFSET;
    let ly = my + side * n.y * OFFSET;
    // Rand-Flip wenn < 20 px vom Rand
    if (lx < 20 || lx > canvas.width - 20 || ly < 20 || ly > canvas.height - 20) {
      lx = mx - side * n.x * OFFSET;
      ly = my - side * n.y * OFFSET;
    }

    const lbl = new fabric.Text(distLabel, {
      left: lx, top: ly,
      fontSize: fs * TOUCH_SCALE, fontWeight: 'bold', fontFamily: 'monospace',
      fill: '#111',
      backgroundColor: DIM_COLOR,
      padding: 2 * TOUCH_SCALE,
      originX: 'center', originY: 'center',
      selectable: false, evented: false, _noSelect: true,
      _dimLinePipeId: measureId,
    });
    dimObjs.push(lbl);
  });

  dimObjs.forEach(o => canvas.add(o));
  // Dim lines immer ganz oben
  dimObjs.forEach(o => canvas.bringToFront(o));
  canvas.renderAll();
}

export function renderAllDimLines() {
  state.measurements
    .filter(m => m.type === 'pipe')
    .forEach(m => renderDimLinesForPipe(m.id));
}

// ─── Verschiebbarer Fußpunkt auf Hilfslinie ──────────────
// Drag-Constraint: Punkt wird auf die Hilfslinie projiziert
canvas.on('object:moving', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || !obj._dimDraggableFoot) return;

  const refId = obj._dimRefId;
  const ref = state.pipeReferences.find(r => r.id === refId);
  if (!ref || ref.type !== 'line') return;

  // Projiziere Mausposition auf die Hilfslinie (unclamped — darf über Enden hinaus)
  const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return;
  const t = ((obj.left - ref.x1) * dx + (obj.top - ref.y1) * dy) / lenSq;
  // Position auf Linie setzen
  obj.left = ref.x1 + t * dx;
  obj.top  = ref.y1 + t * dy;
  obj.setCoords();
}));

// Nach dem Loslassen: Override speichern und Maßlinie neu rendern
canvas.on('object:modified', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || !obj._dimDraggableFoot) return;

  const refId = obj._dimRefId;
  const measId = obj._dimMeasureId;
  const ref = state.pipeReferences.find(r => r.id === refId);
  const meas = state.measurements.find(m => m.id === measId);
  if (!ref || !meas || ref.type !== 'line') return;

  // t berechnen
  const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return;
  const t = ((obj.left - ref.x1) * dx + (obj.top - ref.y1) * dy) / lenSq;

  if (!meas.dimFootOverrides) meas.dimFootOverrides = {};
  meas.dimFootOverrides[refId] = { t };

  // Maßlinie komplett neu rendern mit neuem Fußpunkt
  renderDimLinesForPipe(measId);
  // saveSnapshot() wird vom globalen object:modified-Handler aufgerufen
}));

// Hover-Hinweis für verschiebbare Fußpunkte
canvas.on('mouse:over', opt => {
  if (opt.target && opt.target._dimDraggableFoot) {
    const hint = document.getElementById('status-hint');
    if (hint) hint.textContent = 'Fußpunkt verschieben · Doppelklick = Zurücksetzen';
  }
});
canvas.on('mouse:out', opt => {
  if (opt.target && opt.target._dimDraggableFoot) {
    const hint = document.getElementById('status-hint');
    if (hint) hint.textContent = '';
  }
});

// Doppelklick auf Fußpunkt: Reset auf automatische Berechnung
canvas.on('mouse:dblclick', _safeHandler(opt => {
  const obj = opt.target;
  if (!obj || !obj._dimDraggableFoot) return;

  const refId = obj._dimRefId;
  const measId = obj._dimMeasureId;
  const meas = state.measurements.find(m => m.id === measId);
  if (!meas) return;

  // Override entfernen
  if (meas.dimFootOverrides) {
    delete meas.dimFootOverrides[refId];
  }

  renderDimLinesForPipe(measId);
  saveSnapshot();
}));

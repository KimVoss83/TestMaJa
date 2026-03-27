import { state, TOUCH_SCALE } from '../state.js';
import { canvas } from '../canvas.js';

// Snap-to-Pixel: Rastet Koordinaten auf das nächste Original-Bildpixel ein,
// damit Messungen wiederholbar und konsistent sind.
export function snapToPixel(p) {
  const img = state.backgroundImage;
  if (!img) return p;
  const s = state.imgDisplayScale;
  const origX = Math.round((p.x - img.left) / s);
  const origY = Math.round((p.y - img.top) / s);
  return { x: img.left + origX * s, y: img.top + origY * s };
}

// Project point p onto line defined by ref {x1,y1,x2,y2}
// Returns { point: {x,y}, dist, t }
export function projectPointOnLine(p, ref) {
  const dx = ref.x2 - ref.x1, dy = ref.y2 - ref.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return { point: { x: ref.x1, y: ref.y1 }, dist: Math.hypot(p.x - ref.x1, p.y - ref.y1), t: 0 };
  // Project onto infinite line (not clamped to segment)
  const t = ((p.x - ref.x1) * dx + (p.y - ref.y1) * dy) / lenSq;
  const projX = ref.x1 + t * dx;
  const projY = ref.y1 + t * dy;
  return { point: { x: projX, y: projY }, dist: Math.hypot(p.x - projX, p.y - projY), t };
}

// ─── Geometry helpers für Maßlinien ───────────────────────
// Gibt den Punkt auf Segment [a,b] der p am nächsten liegt (geclampt)
export function closestPointOnSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function addLabel(x, y, text, color, measureId, userSelectable = false) {
  const isLight = state.labelBg;
  const sel = userSelectable || measureId !== null;
  const txt = new fabric.Text(text, {
    left: x, top: y,
    fontSize: state.fontSize * TOUCH_SCALE,
    fill: isLight ? '#000000' : color,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: isLight ? 'rgba(255,255,255,0.92)' : '',
    shadow: isLight ? '' : '1px 1px 3px rgba(0,0,0,0.9)',
    padding: isLight ? Math.round(3 * TOUCH_SCALE) : 0,
    selectable: sel, evented: sel,
    _measureId: measureId,
    _userLabel: userSelectable,
    originX: 'center', originY: 'center',
  });
  canvas.add(txt);
  return txt;
}

export function addEndpointDot(x, y, color, measureId) {
  const dot = new fabric.Circle({
    left: x, top: y, radius: 1 * TOUCH_SCALE,
    fill: color, stroke: '#ffffff', strokeWidth: 0.3 * TOUCH_SCALE,
    originX: 'center', originY: 'center',
    selectable: false, evented: false,
    _measureId: measureId !== -1 ? measureId : undefined,
    _tempDraw: measureId === -1,
    _noSelect: true,
  });
  canvas.add(dot);
  return dot;
}

export function addRefEndmarks(line, color, measureId) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = -dy / len * 4 * TOUCH_SCALE;
  const ny =  dx / len * 4 * TOUCH_SCALE;
  [[line.x1, line.y1], [line.x2, line.y2]].forEach(([cx, cy]) => {
    canvas.add(new fabric.Line([cx + nx, cy + ny, cx - nx, cy - ny], {
      stroke: color, strokeWidth: 0.5 * TOUCH_SCALE,
      selectable: false, evented: false,
      _measureId: measureId, _noSelect: true,
    }));
  });
}

export function addTickMarks(line, color, measureId) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = -dy / len * 4 * TOUCH_SCALE;
  const ny =  dx / len * 4 * TOUCH_SCALE;
  [[line.x1, line.y1], [line.x2, line.y2]].forEach(([cx, cy]) => {
    canvas.add(new fabric.Line([cx + nx, cy + ny, cx - nx, cy - ny], {
      stroke: color, strokeWidth: 0.5 * TOUCH_SCALE,
      selectable: false, evented: false,
      _measureId: measureId, _noSelect: true,
    }));
  });
}

export function ptDist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

// Distance from point p to line segment a–b
export function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

export function formatDistance(m) {
  return m.toFixed(2) + ' m';
}

export function formatArea(m2) {
  return m2.toFixed(2) + ' m²';
}

// Fehler in geeigneter Einheit formatieren (Eingabe: Meter)
export function formatErr(m) {
  if (m >= 1)    return `±${m.toFixed(2)} m`;
  if (m >= 0.01) return `±${(m * 100).toFixed(1)} cm`;
  return `±${(m * 1000).toFixed(1)} mm`;
}

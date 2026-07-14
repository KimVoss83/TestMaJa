import { state, PIPE_TYPES } from '../state.js';
import { canvas } from '../canvas.js';
import { PIPE_LINE_WIDTH } from '../tools/pipe.js';

// =========================================================
// PIPE LEGEND
// =========================================================
export function updatePipeLegend() {
  // Find existing legend position
  let oldLeft = null, oldTop = null;
  const oldLegend = canvas.getObjects().find(o => o._isPipeLegend);
  if (oldLegend) {
    oldLeft = oldLegend.left;
    oldTop = oldLegend.top;
    canvas.remove(oldLegend);
  }

  // Collect unique pipe types on canvas, with depth info
  const typeDepths = new Map(); // typeKey → Set of depths
  canvas.getObjects().forEach(o => {
    if (o._pipeType) {
      if (!typeDepths.has(o._pipeType)) typeDepths.set(o._pipeType, new Set());
      if (o._pipeDepth) typeDepths.get(o._pipeType).add(o._pipeDepth);
    }
  });
  if (typeDepths.size === 0) { canvas.renderAll(); return; }

  const padding = 10;
  const lineH = 18;
  const titleH = 20;
  const sampleW = 30;
  const textStartX = sampleW + 8;

  // Build legend entries
  const entries = [];
  typeDepths.forEach((depths, typeKey) => {
    const pt = PIPE_TYPES[typeKey];
    let label = `● ${pt.label}`;
    if (depths.size > 0) {
      const sorted = [...depths].sort((a, b) => a - b);
      label += ` (${sorted.map(d => d + ' cm').join(', ')})`;
    }
    entries.push({ typeKey, label });
  });

  const maxLabelW = Math.max(...entries.map(e => e.label.length)) * 6;
  const boxW = textStartX + maxLabelW + padding * 2;
  const boxH = titleH + entries.length * lineH + padding * 2;

  const items = [];

  // Background
  items.push(new fabric.Rect({
    left: 0, top: 0, width: boxW, height: boxH,
    fill: 'rgba(255,255,255,0.92)', rx: 6, ry: 6,
    stroke: '#ccc', strokeWidth: 0.5,
  }));

  // Title
  items.push(new fabric.Text('Leitungen', {
    left: padding, top: padding,
    fontSize: 11, fontWeight: 'bold', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    fill: '#333',
  }));

  // Entries
  let y = padding + titleH;
  entries.forEach(entry => {
    const pt = PIPE_TYPES[entry.typeKey];
    // Color line sample
    items.push(new fabric.Line([padding, y + lineH / 2, padding + sampleW, y + lineH / 2], {
      stroke: pt.color, strokeWidth: PIPE_LINE_WIDTH,
      strokeDashArray: pt.dash.length ? pt.dash : undefined,
    }));
    // Label
    items.push(new fabric.Text(entry.label, {
      left: padding + textStartX, top: y + 1,
      fontSize: 10, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fill: '#333',
    }));
    y += lineH;
  });

  const group = new fabric.Group(items, {
    left: oldLeft != null ? oldLeft : (canvas.width - boxW - 20),
    top: oldTop != null ? oldTop : 20,
    selectable: true, evented: true,
    hasControls: false,        // no resize handles — drag only
    subTargetCheck: false,     // prevent clicking into group children
    lockRotation: true,
    _isPipeLegend: true, _noSelect: false,
  });
  group.objectCaching = false;
  canvas.add(group);
  canvas.bringToFront(group);
  canvas.renderAll();
}

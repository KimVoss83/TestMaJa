import { state, PIPE_TYPES, nextMeasureId } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { showToast } from '../ui/modals.js';
import { addEndpointDot, formatDistance } from '../utils/helpers.js';
import { callHook, TOOL_HINTS } from './tool-manager.js';
import { _notifyBadge } from '../ui/statusbar.js';

// =========================================================
// PIPE TOOL
// =========================================================
export const PIPE_LINE_WIDTH = 1.5;
const PIPE_OFFSET_PX = 3; // lateral offset when pipes overlap
const PIPE_HANDLE_RADIUS = 4;

export function handlePipeClick(p) {
  const snapped = callHook('applyParallelSnap', p) || p;
  state.pipePoints.push(snapped);
  callHook('showPipeDistanceGuides', snapped);
  document.getElementById('status-hint').textContent =
    `${state.pipePoints.length} Punkt(e) gesetzt – Doppelklick zum Abschluss`;
}

export function updatePreviewPipe(pts) {
  canvas.getObjects().filter(o => o._pipePreview).forEach(o => canvas.remove(o));
  if (pts.length < 2) return;
  const pt = PIPE_TYPES[state.pipeType];
  state.drawingPipeLine = new fabric.Polyline(pts.map(p => ({ x: p.x, y: p.y })), {
    fill: 'transparent',
    stroke: pt.color, strokeWidth: PIPE_LINE_WIDTH,
    strokeDashArray: pt.dash.length ? pt.dash : undefined,
    selectable: false, evented: false, _noSelect: true, _pipePreview: true,
  });
  canvas.add(state.drawingPipeLine);
  // Show distance guides for last point (cursor position)
  callHook('showPipeDistanceGuides', pts[pts.length - 1]);
  canvas.renderAll();
}

export function finishPipe() {
  canvas.getObjects().filter(o => o._pipePreview).forEach(o => canvas.remove(o));
  callHook('clearPipeDistanceGuides');
  state.drawingPipeLine = null;
  const pts = state.pipePoints.slice();
  if (pts.length < 2) { state.pipePoints = []; return; }

  const pipeType = state.pipeType;
  const pt = PIPE_TYPES[pipeType];
  const depthVal = parseInt(document.getElementById('pipe-depth-input').value);
  const depth = (depthVal > 0) ? depthVal : null;
  const nennweite = document.getElementById('pipe-nennweite-input')?.value.trim() || null;
  const id = nextMeasureId();

  const line = new fabric.Polyline(pts.map(p => ({ x: p.x, y: p.y })), {
    fill: 'transparent',
    stroke: pt.color, strokeWidth: PIPE_LINE_WIDTH,
    strokeDashArray: pt.dash.length ? pt.dash : undefined,
    selectable: true, evented: true,
    _measureId: id, _pipeType: pipeType, _pipeDepth: depth,
    lockMovementX: true, lockMovementY: true,
    hasControls: false, hasBorders: false,
    lockScalingX: true, lockScalingY: true, lockRotation: true,
  });
  canvas.add(line);

  // Label-Tag am letzten Punkt
  if (pts.length >= 2) {
    const lastPt = pts[pts.length - 1];
    const prevPt = pts[pts.length - 2];
    const segAngle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x);
    const perpX = -Math.sin(segAngle) * 8, perpY = Math.cos(segAngle) * 8;
    const sideA = { x: lastPt.x + perpX, y: lastPt.y + perpY };
    const sideB = { x: lastPt.x - perpX, y: lastPt.y - perpY };
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const distA = Math.hypot(sideA.x - cx, sideA.y - cy);
    const distB = Math.hypot(sideB.x - cx, sideB.y - cy);
    const tagPt = distA > distB ? sideA : sideB;
    const tagText = nennweite ? `${pipeType} ${nennweite}` : pipeType;
    const isDark = (hex) => {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return (0.299*r + 0.587*g + 0.114*b) < 128;
    };
    const pipeTag = new fabric.Text(tagText, {
      left: tagPt.x, top: tagPt.y,
      fontSize: 9, fontFamily: 'sans-serif', fontWeight: 'bold',
      fill: isDark(pt.color) ? '#ffffff' : '#111111',
      backgroundColor: pt.color,
      padding: 3,
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      _measureId: id, _pipeType: pipeType, _isPipeTag: true,
      lockMovementX: true, lockMovementY: true,
      hasControls: false, hasBorders: false,
      lockScalingX: true, lockScalingY: true, lockRotation: true,
    });
    canvas.add(pipeTag);
  }

  // Endpoint dots
  pts.forEach(p => addEndpointDot(p.x, p.y, pt.color, id));

  // Apply layer visibility
  if (!state.pipeLayerVisible) {
    canvas.getObjects().filter(o => o._measureId === id && !o._pipeHandle).forEach(o => { o.visible = false; });
  }

  // Place pipe objects behind measurement objects but above background
  sendPipesToBack();

  const depthLabel = depth ? ` (${depth} cm)` : '';
  state.measurements.push({ id, type: 'pipe', label: pt.label + depthLabel, value: null, pipeType, pipeDepth: depth, refs: [], nennweite });
  callHook('updateMeasurementList');
  callHook('updatePipeLegend');
  offsetOverlappingPipes();
  state.pipePoints = [];
  document.getElementById('status-hint').textContent = TOOL_HINTS[state.tool] || '';
  saveSnapshot();
}

// =========================================================
// PIPE EDITING — vertex handles for reshape & resize
// =========================================================
export function startPipeEdit(polyline) {
  endPipeEdit(); // clean up any prior session
  if (!polyline || !polyline._pipeType) return;

  const id = polyline._measureId;
  const pts = polyline.points;
  const handles = [];

  // Fabric Polyline stores points relative to its own origin.
  // We need canvas-absolute coordinates.
  const matrix = polyline.calcTransformMatrix();

  pts.forEach((pt, idx) => {
    const abs = fabric.util.transformPoint(new fabric.Point(pt.x - polyline.pathOffset.x, pt.y - polyline.pathOffset.y), matrix);
    const handle = new fabric.Circle({
      left: abs.x, top: abs.y,
      radius: PIPE_HANDLE_RADIUS,
      fill: '#ffffff', stroke: PIPE_TYPES[polyline._pipeType].color,
      strokeWidth: 1.5,
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      hasControls: false, hasBorders: false,
      _pipeHandle: true, _pipeHandleIdx: idx, _pipeHandleMeasureId: id,
    });
    canvas.add(handle);
    handles.push(handle);
  });

  state.editingPipe = { id, polyline, handles };

  // Make the polyline itself non-selectable during edit (prevent move)
  polyline.selectable = false;
  polyline.evented = false;

  canvas.renderAll();
  document.getElementById('status-hint').textContent =
    'Punkte ziehen zum Bearbeiten · Doppelklick auf Segment = Punkt einfügen · Entf = Punkt löschen';
}

export function endPipeEdit() {
  if (!state.editingPipe) return;
  const { handles, polyline } = state.editingPipe;
  handles.forEach(h => canvas.remove(h));
  callHook('clearPipeDistanceGuides');
  if (polyline) {
    polyline.selectable = true;
    polyline.evented = true;
  }
  state.editingPipe = null;
  canvas.renderAll();
}

export function updatePipeFromHandles() {
  const ep = state.editingPipe;
  if (!ep) return;
  const { polyline, handles } = ep;

  // Collect new absolute positions from handles
  const newAbsPts = handles.map(h => ({ x: h.left, y: h.top }));

  // Remove old polyline & associated dots, rebuild
  const id = ep.id;
  const pipeType = polyline._pipeType;
  const depth = polyline._pipeDepth;
  const pt = PIPE_TYPES[pipeType];

  // Remove old endpoint dots for this pipe
  canvas.getObjects().filter(o => o._measureId === id && o.type === 'circle' && !o._pipeHandle).forEach(o => canvas.remove(o));

  // Remove old polyline
  canvas.remove(polyline);

  // Create new polyline with absolute points
  const newLine = new fabric.Polyline(newAbsPts.map(p => ({ x: p.x, y: p.y })), {
    fill: 'transparent',
    stroke: pt.color, strokeWidth: PIPE_LINE_WIDTH,
    strokeDashArray: pt.dash.length ? pt.dash : undefined,
    selectable: false, evented: false,  // stays non-selectable during edit
    _measureId: id, _pipeType: pipeType, _pipeDepth: depth,
  });
  canvas.add(newLine);

  // New endpoint dots
  newAbsPts.forEach(p => addEndpointDot(p.x, p.y, pt.color, id));

  sendPipesToBack();
  // Bring handles to front
  handles.forEach(h => canvas.bringToFront(h));

  ep.polyline = newLine;

  // Update measurement label with accurate info
  const m = state.measurements.find(m => m.id === id);
  if (m) {
    const depthLabel = depth ? ` (${depth} cm)` : '';
    m.label = pt.label + depthLabel;
    callHook('updateMeasurementList');
  }

  offsetOverlappingPipes();
  canvas.renderAll();
}

// Insert a new vertex into the pipe at a given segment
export function insertPipeVertex(segIndex, point) {
  const ep = state.editingPipe;
  if (!ep) return;
  const pt = PIPE_TYPES[ep.polyline._pipeType];
  const id = ep.id;

  // Create new handle
  const handle = new fabric.Circle({
    left: point.x, top: point.y,
    radius: PIPE_HANDLE_RADIUS,
    fill: '#ffffff', stroke: pt.color,
    strokeWidth: 1.5,
    originX: 'center', originY: 'center',
    selectable: true, evented: true,
    hasControls: false, hasBorders: false,
    _pipeHandle: true, _pipeHandleIdx: segIndex + 1, _pipeHandleMeasureId: id,
  });

  // Insert handle into array
  ep.handles.splice(segIndex + 1, 0, handle);
  // Re-index all handles
  ep.handles.forEach((h, i) => { h._pipeHandleIdx = i; });

  canvas.add(handle);
  updatePipeFromHandles();
}

// Delete vertex from edited pipe
export function deletePipeVertex(handleIdx) {
  const ep = state.editingPipe;
  if (!ep || ep.handles.length <= 2) return; // need at least 2 points

  const h = ep.handles[handleIdx];
  canvas.remove(h);
  ep.handles.splice(handleIdx, 1);
  ep.handles.forEach((h, i) => { h._pipeHandleIdx = i; });
  updatePipeFromHandles();
}

// =========================================================
// PIPE LAYER TOGGLE & SIDEBAR PANEL
// =========================================================
export function togglePipeLayer() {
  state.pipeLayerVisible = !state.pipeLayerVisible;
  const visible = state.pipeLayerVisible;
  const pipeIds = new Set(state.measurements.filter(m => m.type === 'pipe').map(m => m.id));
  canvas.getObjects().forEach(o => {
    if (o._isPipeLegend || o._pipeType || o._isPipeTag) { o.visible = visible; return; }
    if (o._measureId != null && pipeIds.has(o._measureId) && !o._pipeHandle) { o.visible = visible; return; }
    if (o._dimLinePipeId != null && pipeIds.has(o._dimLinePipeId)) { o.visible = visible; return; }
  });
  canvas.renderAll();
  updatePipePanel();
}

// Push all pipe objects behind measurement objects but above background
export function sendPipesToBack() {
  const pipeObjs = canvas.getObjects().filter(o => o._pipeType && !o._isPipeLegend);
  pipeObjs.forEach(o => canvas.sendToBack(o));
  // Keep background image at very back
  if (state.backgroundImage) canvas.sendToBack(state.backgroundImage);
}

// Offset overlapping pipe lines so they appear side by side
export function offsetOverlappingPipes() {
  const pipeLines = canvas.getObjects().filter(o => o._pipeType && o.type === 'polyline' && !o._pipePreview);
  if (pipeLines.length < 2) return;

  // Group pipes by shared segments (approximate: same start/end points within tolerance)
  const tol = 5;
  const ptKey = (x, y) => `${Math.round(x / tol) * tol},${Math.round(y / tol) * tol}`;

  // Build segment map: for each pair of consecutive points, track which pipes use it
  const segMap = new Map();
  pipeLines.forEach(pl => {
    const pts = pl.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const k1 = ptKey(pts[i].x, pts[i].y);
      const k2 = ptKey(pts[i + 1].x, pts[i + 1].y);
      const segKey = [k1, k2].sort().join('|');
      if (!segMap.has(segKey)) segMap.set(segKey, []);
      segMap.get(segKey).push(pl);
    }
  });

  // For pipes sharing segments, compute lateral offset
  // Reset all pipe transforms first
  pipeLines.forEach(pl => {
    if (pl._pipeOffset) {
      // Remove old offset - rebuild points from original
      if (pl._origPoints) {
        pl.points = pl._origPoints.map(p => ({ x: p.x, y: p.y }));
        pl._pipeOffset = 0;
      }
    }
  });

  // Find groups of overlapping pipes
  const processed = new Set();
  segMap.forEach((pipes, segKey) => {
    if (pipes.length < 2) return;
    // Unique pipes in this overlap group
    const unique = [...new Set(pipes)];
    const groupKey = unique.map(p => p._measureId).sort().join(',');
    if (processed.has(groupKey)) return;
    processed.add(groupKey);

    const n = unique.length;
    unique.forEach((pl, idx) => {
      const offset = (idx - (n - 1) / 2) * PIPE_OFFSET_PX;
      if (Math.abs(offset) < 0.1) return;

      // Store original points
      if (!pl._origPoints) pl._origPoints = pl.points.map(p => ({ x: p.x, y: p.y }));

      // Offset each segment perpendicular
      const origPts = pl._origPoints;
      const newPts = origPts.map((p, i) => {
        // Compute average normal at this point
        let nx = 0, ny = 0, count = 0;
        if (i > 0) {
          const dx = origPts[i].x - origPts[i - 1].x;
          const dy = origPts[i].y - origPts[i - 1].y;
          const len = Math.hypot(dx, dy) || 1;
          nx += -dy / len; ny += dx / len; count++;
        }
        if (i < origPts.length - 1) {
          const dx = origPts[i + 1].x - origPts[i].x;
          const dy = origPts[i + 1].y - origPts[i].y;
          const len = Math.hypot(dx, dy) || 1;
          nx += -dy / len; ny += dx / len; count++;
        }
        if (count > 0) { nx /= count; ny /= count; }
        return { x: p.x + nx * offset, y: p.y + ny * offset };
      });
      pl.points = newPts;
      pl._pipeOffset = offset;
      pl.dirty = true;
    });
  });
  canvas.renderAll();
}

export function updatePipePanel() {
  const panel = document.getElementById('pipe-layer-list');
  const toggleBtn = document.getElementById('btn-pipe-layer-toggle');
  if (!panel) return;

  if (toggleBtn) {
    toggleBtn.textContent = state.pipeLayerVisible ? 'Sichtbar' : 'Ausgeblendet';
    toggleBtn.classList.toggle('hidden-layer', !state.pipeLayerVisible);
  }

  const pipes = state.measurements.filter(m => m.type === 'pipe');
  _notifyBadge('badge-leitungen', 'acc-leitungen', pipes.length, 'leitungen');
  if (pipes.length === 0) {
    panel.innerHTML = '<div style="font-size:11px;color:#8e8e93;padding:2px 0;">Keine Leitungen</div>';
    return;
  }

  // Group by pipeType
  const groups = {};
  pipes.slice().reverse().forEach(m => {
    if (!groups[m.pipeType]) groups[m.pipeType] = [];
    groups[m.pipeType].push(m);
  });

  let html = '';
  Object.entries(groups).forEach(([typeKey, items]) => {
    const pt = PIPE_TYPES[typeKey];

    // Total length of all pipes of this type
    let totalStr = '';
    if (state.scale) {
      let totalPx = 0;
      canvas.getObjects().filter(o => o._pipeType === typeKey && o.type === 'polyline' && !o._pipePreview).forEach(o => {
        const pts = o.points;
        for (let i = 0; i < pts.length - 1; i++)
          totalPx += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
      });
      if (totalPx > 0) totalStr = formatDistance((totalPx / state.imgDisplayScale) / state.scale);
    }

    html += `<div class="pipe-group">`;
    html += `<div class="pipe-group-header" style="border-left:3px solid ${pt.color}">`;
    html += `<span class="pipe-group-icon">${pt.icon}</span>`;
    html += `<span class="pipe-group-name">${pt.label}</span>`;
    if (totalStr) html += `<span class="pipe-group-total">${totalStr}</span>`;
    html += `</div>`;

    items.forEach(m => {
      let lenStr = '';
      if (state.scale) {
        const obj = canvas.getObjects().find(o => o._measureId === m.id && o.type === 'polyline' && !o._pipePreview);
        if (obj) {
          let px = 0;
          const pts = obj.points;
          for (let i = 0; i < pts.length - 1; i++) px += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
          lenStr = formatDistance((px / state.imgDisplayScale) / state.scale);
        }
      }
      const depthStr = m.pipeDepth ? ` · ${m.pipeDepth} cm` : '';
      const availRefs = state.pipeReferences;
      const assignedRefs = m.refs || [];

      // Hauptzeile: Länge + Tiefe | Löschen
      html += `<div class="pipe-item" style="flex-wrap:wrap;">`;
      html += `<span class="pipe-item-info">${lenStr || '–'}${depthStr}</span>`;
      html += `<button class="m-delete" onclick="removeMeasurement(${m.id})" title="Leitung löschen"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;

      // Checkbox-Liste aller verfügbaren Hilfslinien/Hilfspunkte direkt inline
      if (availRefs.length > 0) {
        html += `<div style="width:100%;padding:2px 0 1px 12px;display:flex;flex-direction:column;gap:1px;">`;
        availRefs.forEach(ref => {
          const isAssigned = assignedRefs.includes(ref.id);
          const icon = ref.type === 'line'
            ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px"><line x1="12" y1="2" x2="12" y2="22"/></svg>'
            : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px"><polygon points="12 2 22 12 12 22 2 12"/></svg>';
          html += `<label style="display:flex;align-items:center;gap:4px;font-size:10px;color:#374151;cursor:pointer;padding:1px 0;">
            <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="directToggleRef(${m.id}, ${ref.id}, this.checked)" style="margin:0;accent-color:#6366f1;" />
            ${icon} <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ref.name}</span>
          </label>`;
        });
        html += `</div>`;
      } else {
        html += `<div style="width:100%;padding:2px 0 1px 12px;font-size:10px;color:#9ca3af;">Noch keine Hilfslinien vorhanden</div>`;
      }

      html += `</div>`;
    });

    html += `</div>`;
  });

  panel.innerHTML = html;
}

// Expose for inline onclick handlers
window.togglePipeLayer = togglePipeLayer;

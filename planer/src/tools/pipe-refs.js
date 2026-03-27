import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { createModal, showToast } from '../ui/modals.js';
import { _notifyBadge } from '../ui/statusbar.js';
import { updatePipePanel, sendPipesToBack } from './pipe.js';

// =========================================================
// PIPE REFERENCES — Grenzlinien & Referenzpunkte
// =========================================================
let pipeRefId = 0;

export const PIPE_REF_LINE_COLOR = '#FF9500';
const PIPE_REF_POINT_COLOR = '#FF2D55';
export const PIPE_REF_GUIDE_COLOR = 'rgba(255,59,48,0.6)';

export function handlePipeRefClick(p) {
  if (state.pipeRefMode === 'line-1') {
    // First point of reference line
    state.pipeRefTempPt = p;
    state.pipeRefMode = 'line-2';
    // Temp dot
    const dot = new fabric.Circle({
      left: p.x, top: p.y, radius: 3,
      fill: PIPE_REF_LINE_COLOR, stroke: '#fff', strokeWidth: 1,
      originX: 'center', originY: 'center',
      selectable: false, evented: false, _pipeRefTemp: true, _noSelect: true,
    });
    canvas.add(dot);
    canvas.renderAll();
    document.getElementById('status-hint').textContent = 'Endpunkt der Hilfslinie klicken …';
    return true;
  }
  if (state.pipeRefMode === 'line-2') {
    // Second point → prompt name, create reference line
    const p1 = state.pipeRefTempPt;
    canvas.getObjects().filter(o => o._pipeRefTemp).forEach(o => canvas.remove(o));
    promptPipeRefName('Hilfslinie benennen', name => {
      createPipeRefLine(p1, p, name || 'Hilfslinie');
    });
    state.pipeRefMode = null;
    state.pipeRefTempPt = null;
    document.getElementById('btn-pipe-ref-line').classList.remove('active');
    return true;
  }
  if (state.pipeRefMode === 'point') {
    // Create reference point → prompt name
    promptPipeRefName('Hilfspunkt benennen', name => {
      createPipeRefPoint(p, name || 'Hilfspunkt');
    });
    state.pipeRefMode = null;
    document.getElementById('btn-pipe-ref-point').classList.remove('active');
    return true;
  }
  return false;
}

export function promptPipeRefName(title, cb) {
  createModal(title,
    `<input type="text" id="pipe-ref-name-input" placeholder="z.B. Grundstücksgrenze, Hauswand Nord" style="width:100%" />`,
    () => { cb(document.getElementById('pipe-ref-name-input').value.trim()); }
  );
  setTimeout(() => document.getElementById('pipe-ref-name-input')?.focus(), 80);
}

export function createPipeRefLine(p1, p2, name) {
  const id = ++pipeRefId;

  // Canvas line
  const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
    stroke: PIPE_REF_LINE_COLOR, strokeWidth: 1.5,
    strokeDashArray: [8, 4],
    selectable: true, evented: true,
    _pipeRefId: id, _pipeRefType: 'line', _pipeRefName: name,
    lockMovementX: true, lockMovementY: true,
  });
  canvas.add(line);

  // Label at midpoint
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const offX = -Math.sin(angle) * 10, offY = Math.cos(angle) * 10;
  const txt = new fabric.Text(name, {
    left: mx + offX, top: my + offY,
    fontSize: 6, fontWeight: 'bold', fontFamily: 'monospace',
    fill: PIPE_REF_LINE_COLOR,
    backgroundColor: 'rgba(255,255,255,0.85)', padding: 1,
    originX: 'center', originY: 'center',
    selectable: true, evented: true,
    _pipeRefId: id, _pipeRefType: 'line-label',
    lockMovementX: true, lockMovementY: true,
  });
  canvas.add(txt);

  // Endpoint markers
  [p1, p2].forEach(pt => {
    canvas.add(new fabric.Circle({
      left: pt.x, top: pt.y, radius: 2.5,
      fill: PIPE_REF_LINE_COLOR, stroke: '#fff', strokeWidth: 0.8,
      originX: 'center', originY: 'center',
      selectable: false, evented: false,
      _pipeRefId: id, _noSelect: true,
    }));
  });

  state.pipeReferences.push({ id, type: 'line', name, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  state.activePipeRefs.push(id); // auto-activate
  updatePipeRefList();
  updatePipePanel();
  sendPipesToBack();
  canvas.renderAll();
  document.getElementById('status-hint').textContent = '';

}

export function createPipeRefPoint(p, name) {
  const id = ++pipeRefId;

  // Diamond marker
  const size = 3.5;
  const diamond = new fabric.Polygon([
    { x: p.x, y: p.y - size },
    { x: p.x + size, y: p.y },
    { x: p.x, y: p.y + size },
    { x: p.x - size, y: p.y },
  ], {
    fill: PIPE_REF_POINT_COLOR, stroke: '#fff', strokeWidth: 0.8,
    selectable: true, evented: true,
    _pipeRefId: id, _pipeRefType: 'point',
    lockMovementX: true, lockMovementY: true,
  });
  canvas.add(diamond);

  // Label
  const txt = new fabric.Text(name, {
    left: p.x + 6, top: p.y - 6,
    fontSize: 6, fontWeight: 'bold', fontFamily: 'monospace',
    fill: PIPE_REF_POINT_COLOR,
    backgroundColor: 'rgba(255,255,255,0.85)', padding: 1,
    selectable: true, evented: true,
    _pipeRefId: id, _pipeRefType: 'point-label',
    lockMovementX: true, lockMovementY: true,
  });
  canvas.add(txt);

  state.pipeReferences.push({ id, type: 'point', name, x: p.x, y: p.y });
  state.activePipeRefs.push(id); // auto-activate
  updatePipeRefList();
  updatePipePanel();
  sendPipesToBack();
  canvas.renderAll();
  document.getElementById('status-hint').textContent = '';

}

export function removePipeRef(refId) {
  // Guard: blockiere Löschen wenn Rohre diese Referenz nutzen
  const users = state.measurements.filter(m => m.type === 'pipe' && m.refs?.includes(refId));
  if (users.length > 0) {
    showToast(`Referenz wird von ${users.length} Leitung(en) verwendet – zuerst Zuordnung aufheben.`);
    return;
  }
  saveSnapshot();
  canvas.getObjects().filter(o => o._pipeRefId === refId).forEach(o => canvas.remove(o));
  state.pipeReferences = state.pipeReferences.filter(r => r.id !== refId);
  state.activePipeRefs = state.activePipeRefs.filter(id => id !== refId);
  updatePipeRefList();
  updatePipePanel();
  canvas.renderAll();
}

export function togglePipeRef(refId, active) {
  if (active && !state.activePipeRefs.includes(refId)) {
    state.activePipeRefs.push(refId);
  } else if (!active) {
    state.activePipeRefs = state.activePipeRefs.filter(id => id !== refId);
  }
}

export function updatePipeRefList() {
  const list = document.getElementById('pipe-ref-list');
  _notifyBadge('badge-hilfslinien', 'acc-hilfslinien', state.pipeReferences.length, 'hilfslinien');
  if (!state.pipeReferences.length) {
    list.innerHTML = '<div style="font-size:10px;color:#888;padding:2px 0;">Keine Hilfslinien gesetzt</div>';
    return;
  }
  list.innerHTML = state.pipeReferences.map(r => {
    const icon = r.type === 'line'
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="12" y1="2" x2="12" y2="22"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polygon points="12 2 22 12 12 22 2 12"/></svg>';
    const checked = state.activePipeRefs.includes(r.id) ? 'checked' : '';
    return `<div class="pipe-ref-item">
      <input type="checkbox" ${checked} onchange="togglePipeRef(${r.id}, this.checked)" />
      <span class="ref-name">${icon} ${r.name}</span>
      <button class="ref-delete" onclick="removePipeRef(${r.id})" title="Hilfslinie löschen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  }).join('');
}

// Expose for inline onclick handlers
window.removePipeRef = removePipeRef;
window.togglePipeRef = togglePipeRef;

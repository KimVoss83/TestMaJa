import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addEndpointDot, snapToPixel, canvasScale } from '../utils/helpers.js';
import { createModal, showToast } from '../ui/modals.js';
import { pointInPolygon, intersectionArea, MIN_ABZUG_M2 } from '../woflv/calc.js';
import { rebuildRooms } from './room.js';

let _draft = [];
let _targetRoom = null;
let _zoneId = 1;

export function handleZoneClick(p, mode) {
  const pt = snapToPixel(p);
  if (_draft.length === 0) {
    _targetRoom = state.rooms.find(r => pointInPolygon(pt, r.polygon));
    if (!_targetRoom) { showToast('Bitte in einen vorhandenen Raum klicken.', 'warning'); return; }
  }
  _draft.push(pt);
  addEndpointDot(pt.x, pt.y, mode === 'zone' ? '#ff9500' : '#ff3b30', -1);
  const last = _draft[_draft.length - 2];
  if (last) canvas.add(new fabric.Line([last.x, last.y, pt.x, pt.y], {
    stroke: mode === 'zone' ? '#ff9500' : '#ff3b30', strokeWidth: 1, strokeDashArray: [5, 3],
    selectable: false, evented: false, _noSelect: true, _tempDraw: true,
  }));
  canvas.renderAll();
}

// Doppelklick feuert vorher 2× mouse:down → letzte Punkte deduplizieren
function dedupePoints(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 2) out.push(p);
  }
  return out;
}

export function handleZoneDblClick(mode) {
  const polygon = dedupePoints(_draft);
  if (polygon.length < 3 || !_targetRoom) { cancelZoneDraft(); return; }
  const room = _targetRoom;
  cancelZoneDraft();
  if (mode === 'zone') {
    createModal('Höhenzone', `
      <p>Wie hoch ist der Bereich (Dachschräge)?</p>
      <select id="zone-height">
        <option value="1bis2m">1 – 2 m → zählt 50 %</option>
        <option value="unter1m">unter 1 m → zählt 0 %</option>
      </select>`,
      () => {
        room.zones.push({ id: _zoneId++, polygon, height: document.getElementById('zone-height').value });
        rebuildRooms(); saveSnapshot(); window.updateRoomList?.();
      }, () => {});
  } else {
    createModal('Abzugsfläche', `
      <p>Bezeichnung (z.B. Kamin, Pfeiler, Treppe):</p>
      <input type="text" id="ded-label" placeholder="Kamin" />`,
      () => {
        const label = document.getElementById('ded-label').value.trim() || 'Abzug';
        room.deductions.push({ id: _zoneId++, polygon, label });
        // §3(3)-Hinweis: zu kleine Abzüge zählen nicht
        const cs = canvasScale();
        const a = intersectionArea(polygon, room.polygon) / (cs * cs);
        if (a <= MIN_ABZUG_M2)
          showToast(`Abzug „${label}“ ist ≤ 0,1 m² und zählt nach WoFlV §3(3) nicht.`, 'warning');
        rebuildRooms(); saveSnapshot(); window.updateRoomList?.();
      }, () => {});
  }
}

export function cancelZoneDraft() {
  _draft = []; _targetRoom = null;
  canvas.getObjects().filter(o => o._tempDraw).forEach(o => canvas.remove(o));
  canvas.renderAll();
}

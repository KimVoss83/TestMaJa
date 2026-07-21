import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addEndpointDot, snapToPixel } from '../utils/helpers.js';
import { createModal, showToast } from '../ui/modals.js';
import { roomCalc, fmt2 } from '../woflv/calc.js';
import { escHtml } from '../utils/helpers.js';

export const ROOM_COLORS = {
  'normal': '#4a90d9', 'wintergarten-unbeh': '#34c759', 'schwimmbad': '#30b0c7',
  'balkon': '#ff9500', 'loggia': '#ff9500', 'terrasse': '#ffcc00', 'dachgarten': '#a2845e',
};
const ZONE_COLORS = { '1bis2m': 'rgba(255,149,0,0.30)', 'unter1m': 'rgba(255,59,48,0.30)' };
let _roomId = 1;

function snapOrtho(p, last) {
  if (!state.roomSnap || !last) return p;
  return Math.abs(p.x - last.x) > Math.abs(p.y - last.y)
    ? { x: p.x, y: last.y } : { x: last.x, y: p.y };
}

export function handleRoomClick(p, ev) {
  const free = ev?.shiftKey;                       // Shift = Snap aus
  const last = state.roomDraft[state.roomDraft.length - 1];
  const pt = free ? p : snapOrtho(snapToPixel(p), last);
  state.roomDraft.push(pt);
  addEndpointDot(pt.x, pt.y, '#4a90d9', -1);
  if (last) {
    canvas.add(new fabric.Line([last.x, last.y, pt.x, pt.y], {
      stroke: '#4a90d9', strokeWidth: 1, strokeDashArray: [5, 3],
      selectable: false, evented: false, _noSelect: true, _tempDraw: true,
    }));
  }
  canvas.renderAll();
}

// Doppelklick feuert vorher 2× mouse:down → letzte Punkte können Duplikate sein.
function dedupePoints(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 2) out.push(p);
  }
  return out;
}

export function handleRoomDblClick() {
  const polygon = dedupePoints(state.roomDraft);
  if (polygon.length < 3) { cancelRoomDraft(); return; }
  cancelRoomDraft();
  createModal('Raum anlegen', `
    <input type="text" id="room-name" placeholder="z.B. Wohnzimmer" />
    <select id="room-kind">
      <option value="wohnflaeche">Wohnfläche</option>
      <option value="zubehoer">Zubehör — zählt nicht (Keller, Abstellraum …)</option>
    </select>
    <select id="room-cat">
      <option value="normal">Normaler Raum — 100 %</option>
      <option value="wintergarten-unbeh">Wintergarten (unbeheizt) — 50 %</option>
      <option value="schwimmbad">Schwimmbad — 50 %</option>
      <option value="balkon">Balkon — 25 %</option>
      <option value="loggia">Loggia — 25 %</option>
      <option value="terrasse">Terrasse — 25 %</option>
      <option value="dachgarten">Dachgarten — 25 %</option>
    </select>`,
    () => {
      const name = document.getElementById('room-name').value.trim() || `Raum ${_roomId}`;
      state.rooms.push({
        id: _roomId++, name,
        kind: document.getElementById('room-kind').value,
        category: document.getElementById('room-cat').value,
        balkonFaktor: 0.25, polygon, zones: [], deductions: [],
      });
      rebuildRooms(); saveSnapshot();
      window.updateRoomList?.();
    },
    () => {});
  setTimeout(() => document.getElementById('room-name')?.focus(), 80);
}

export function cancelRoomDraft() {
  state.roomDraft = [];
  canvas.getObjects().filter(o => o._tempDraw).forEach(o => canvas.remove(o));
  canvas.renderAll();
}

function centroid(pts) {
  const n = pts.length;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

// Alle Raum-Objekte neu zeichnen — einzige Render-Quelle für Räume.
export function rebuildRooms() {
  canvas.getObjects().filter(o => o._roomId != null).forEach(o => canvas.remove(o));
  for (const room of state.rooms) {
    const color = ROOM_COLORS[room.category] || ROOM_COLORS.normal;
    canvas.add(new fabric.Polygon(room.polygon, {
      fill: color + '33', stroke: color, strokeWidth: 1.5,
      selectable: false, evented: false, _noSelect: true, _roomId: room.id,
      objectCaching: false,
    }));
    for (const z of room.zones) canvas.add(new fabric.Polygon(z.polygon, {
      fill: ZONE_COLORS[z.height], stroke: 'rgba(0,0,0,0.35)', strokeWidth: 0.75,
      strokeDashArray: [4, 3], selectable: false, evented: false,
      _noSelect: true, _roomId: room.id, objectCaching: false,
    }));
    for (const d of room.deductions) canvas.add(new fabric.Polygon(d.polygon, {
      fill: 'rgba(255,59,48,0.35)', stroke: '#ff3b30', strokeWidth: 1,
      selectable: false, evented: false, _noSelect: true, _roomId: room.id,
      objectCaching: false,
    }));
    const c = centroid(room.polygon);
    const m2 = state.scale ? fmt2(roomCalc(room, state.scale).anrechenbar) + ' m²' : '– m²';
    canvas.add(new fabric.Text(`${room.name}\n${m2}`, {
      left: c.x, top: c.y, originX: 'center', originY: 'center',
      fontSize: 13, fontFamily: 'Inter, sans-serif', fill: '#1d1d1f',
      textAlign: 'center', selectable: false, evented: false,
      _noSelect: true, _roomId: room.id, objectCaching: false,
    }));
  }
  canvas.renderAll();
}

// Für save-load: höchste vergebene ID wiederherstellen
export function syncRoomIdCounter() {
  _roomId = Math.max(0, ...state.rooms.map(r => r.id)) + 1;
}

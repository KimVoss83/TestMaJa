import { state } from '../state.js';
import { saveSnapshot } from '../undo.js';
import { escHtml, canvasScale } from '../utils/helpers.js';
import { createModal } from './modals.js';
import { totals, fmt2, BALKON_KATEGORIEN } from '../woflv/calc.js';
import { rebuildRooms, ROOM_COLORS } from '../tools/room.js';

const KIND_LABEL = { wohnflaeche: '', zubehoer: ' (Zubehör)' };

export function updateRoomList() {
  const list = document.getElementById('room-list');
  const sums = document.getElementById('room-sums');
  const badge = document.getElementById('badge-raeume');
  if (!list) return;
  const t = totals(state.rooms, state.scale ? canvasScale() : 1);
  badge.textContent = String(state.rooms.length);

  list.innerHTML = t.perRoom.map(({ room, calc }) => {
    const color = ROOM_COLORS[room.category] || ROOM_COLORS.normal;
    const faktorStr = room.kind === 'zubehoer' ? '—'
      : calc.zone50 + calc.zone0 > 0 ? 'Zonen' : `×${String(calc.faktor).replace('.', ',')}`;
    return `<div class="room-row" data-id="${room.id}" style="display:flex;justify-content:space-between;
        gap:6px;padding:5px 2px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer;font-size:12px;">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:4px;"></span>
        ${escHtml(room.name)}${KIND_LABEL[room.kind]}</span>
      <span style="color:#6b7280;">${fmt2(calc.roh)} m²</span>
      <span style="color:#8e8e93;">${faktorStr}</span>
      <b>${fmt2(calc.anrechenbar)} m²</b>
    </div>`;
  }).join('') || '<div style="font-size:11px;color:#9ca3af;padding:4px 0;">Noch keine Räume — Raum-Werkzeug nutzen.</div>';

  sums.innerHTML =
    `<div style="display:flex;justify-content:space-between;">Wohnfläche <b>${fmt2(t.wohnflaeche)} m²</b></div>` +
    `<div style="display:flex;justify-content:space-between;color:#6b7280;font-weight:400;">Nutzfläche (nachr.) <span>${fmt2(t.nutzflaeche)} m²</span></div>`;

  list.querySelectorAll('.room-row').forEach(el => {
    el.onclick = () => editRoom(parseInt(el.dataset.id));
  });
}

function editRoom(id) {
  const room = state.rooms.find(r => r.id === id);
  if (!room) return;
  const isBalkon = BALKON_KATEGORIEN.includes(room.category);
  createModal('Raum bearbeiten', `
    <input type="text" id="er-name" value="${escHtml(room.name)}" />
    <select id="er-kind">
      <option value="wohnflaeche"${room.kind === 'wohnflaeche' ? ' selected' : ''}>Wohnfläche</option>
      <option value="zubehoer"${room.kind === 'zubehoer' ? ' selected' : ''}>Zubehör — zählt nicht</option>
    </select>
    <select id="er-cat">
      ${['normal', 'wintergarten-unbeh', 'schwimmbad', 'balkon', 'loggia', 'terrasse', 'dachgarten']
        .map(c => `<option value="${c}"${room.category === c ? ' selected' : ''}>${c}</option>`).join('')}
    </select>
    ${isBalkon ? `<label style="font-size:12px;">Anrechnungsfaktor (0,25–0,5):
      <input type="number" id="er-faktor" min="0.25" max="0.5" step="0.05" value="${room.balkonFaktor}" /></label>` : ''}
    <button id="er-delete" style="margin-top:8px;color:#ff3b30;background:none;border:1px solid #ff3b30;
      border-radius:8px;padding:6px 12px;cursor:pointer;">Raum löschen</button>`,
    () => {
      room.name = document.getElementById('er-name').value.trim() || room.name;
      room.kind = document.getElementById('er-kind').value;
      room.category = document.getElementById('er-cat').value;
      const f = parseFloat(document.getElementById('er-faktor')?.value);
      if (!isNaN(f)) room.balkonFaktor = Math.min(0.5, Math.max(0.25, f));
      rebuildRooms(); updateRoomList(); saveSnapshot();
    },
    () => {});
  // Löschen-Button separat verdrahten (schließt Modal über Cancel-Pfad)
  setTimeout(() => {
    const del = document.getElementById('er-delete');
    if (del) del.onclick = () => {
      state.rooms = state.rooms.filter(r => r.id !== id);
      rebuildRooms(); updateRoomList(); saveSnapshot();
      document.querySelector('.modal-overlay #modal-cancel')?.click();
    };
  }, 50);
}

window.updateRoomList = updateRoomList;

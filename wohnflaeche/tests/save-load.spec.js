import { test, expect } from '@playwright/test';
import { setupApp } from './helpers.js';

// Hinweis (Task 10): save-load.js exportierte vor diesem Task keine reinen
// Build/Load-Funktionen für das Projekt-JSON — Speichern/Laden waren als
// doSaveProjectJSON() (baut JSON + löst Datei-Download aus) bzw. als anonymer
// input#json-input.onchange-Handler (FileReader → JSON.parse → canvas.loadFromJSON)
// implementiert. Für Task 10 wurde die reine Bau-/Wiederherstell-Logik in
// buildProjectJSON() / loadProjectJSON(jsonString) extrahiert (Namen wie im
// Brief vorgeschlagen) und von den bestehenden Handlern wiederverwendet.
// Das bestehende Projekt-Format war bereits bei version: 3 (refLines/grid/
// measurements kamen in früheren Tasks dazu) — Task 10 ergänzt rooms/
// printScale/pdfPage und zählt hoch auf version: 4 statt (wie im Brief
// als Platzhalter angenommen) auf version: 2.
test('Räume überleben Speichern → Laden (Round-Trip)', async ({ page }) => {
  await setupApp(page);
  const json = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { rebuildRooms, syncRoomIdCounter } = await import('/src/tools/room.js');
    const sl = await import('/src/io/save-load.js');
    const s = state.scale * state.imgDisplayScale; // Canvas-px pro Meter
    state.rooms = [{ id: 1, name: 'Küche', kind: 'wohnflaeche', category: 'normal',
      balkonFaktor: 0.25,
      polygon: [{x:100,y:100},{x:100+3*s,y:100},{x:100+3*s,y:100+2*s},{x:100,y:100+2*s}],
      zones: [{ id: 1, polygon: [{x:110,y:110},{x:160,y:110},{x:160,y:160},{x:110,y:160}], height: '1bis2m' }],
      deductions: [] }];
    syncRoomIdCounter(); rebuildRooms();
    return sl.buildProjectJSON();
  });
  const restored = await page.evaluate(async (j) => {
    const { state } = await import('/src/state.js');
    const sl = await import('/src/io/save-load.js');
    state.rooms = [];
    await sl.loadProjectJSON(j);
    return { n: state.rooms.length, name: state.rooms[0]?.name,
             zones: state.rooms[0]?.zones.length, version: JSON.parse(j).version };
  }, json);
  expect(restored.version).toBe(4);
  expect(restored.n).toBe(1);
  expect(restored.name).toBe('Küche');
  expect(restored.zones).toBe(1);
});

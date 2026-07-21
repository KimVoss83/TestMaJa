import { test, expect } from '@playwright/test';
import { setupApp } from './helpers.js';

test('50%-Zone im Raum reduziert die Summe; Mini-Abzug wird ignoriert', async ({ page }) => {
  await setupApp(page);
  // Raum 4×3 m programmgesteuert anlegen
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { rebuildRooms, syncRoomIdCounter } = await import('/src/tools/room.js');
    const s = state.scale;
    state.rooms = [{ id: 1, name: 'DG-Zimmer', kind: 'wohnflaeche', category: 'normal',
      balkonFaktor: 0.25,
      polygon: [{x:100,y:100},{x:100+4*s,y:100},{x:100+4*s,y:100+3*s},{x:100,y:100+3*s}],
      zones: [], deductions: [] }];
    syncRoomIdCounter(); rebuildRooms(); window.updateRoomList();
  });
  const before = await page.evaluate(() =>
    document.getElementById('room-sums').textContent);
  expect(before).toContain('12,00');
  // Zone (halber Raum, 4×1,5 m) per Werkzeug einzeichnen
  const s = await page.evaluate(async () => (await import('/src/state.js')).state.scale);
  const box = await page.locator('#c').boundingBox();
  await page.click('#btn-zone');
  const px = v => box.x + 100 + v, py = v => box.y + 100 + v;
  await page.mouse.click(px(2), py(2)); await page.waitForTimeout(100);
  await page.mouse.click(px(4 * s - 2), py(2)); await page.waitForTimeout(100);
  await page.mouse.click(px(4 * s - 2), py(1.5 * s)); await page.waitForTimeout(100);
  await page.mouse.dblclick(px(2), py(1.5 * s)); await page.waitForTimeout(200);
  // Höhen-Auswahl-Modal: 1–2 m wählen
  await page.selectOption('#zone-height', '1bis2m');
  await page.click('#modal-ok');
  const after = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { roomCalc } = await import('/src/woflv/calc.js');
    return roomCalc(state.rooms[0], state.scale).anrechenbar;
  });
  expect(after).toBeGreaterThan(8.5);   // ~9 m² (6 + 0,5·6), Zeichen-Toleranz
  expect(after).toBeLessThan(9.5);
});

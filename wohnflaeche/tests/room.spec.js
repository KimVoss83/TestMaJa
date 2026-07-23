import { test, expect } from '@playwright/test';
import { setupApp, DEMO } from './helpers.js';

test('Raum zeichnen → state.rooms + korrektes Label', async ({ page }) => {
  await setupApp(page);
  const box = await page.locator('#c').boundingBox();
  await page.click('#btn-room');
  // 90°-Snap default: leicht schiefe Klicks müssen orthogonal einrasten
  await page.mouse.click(box.x + 300, box.y + 200); await page.waitForTimeout(100);
  await page.mouse.click(box.x + 600, box.y + 205); await page.waitForTimeout(100);
  await page.mouse.click(box.x + 597, box.y + 400); await page.waitForTimeout(100);
  await page.mouse.dblclick(box.x + 300, box.y + 398); await page.waitForTimeout(200);
  // Modal: Name eintragen, bestätigen
  await page.fill('#room-name', 'Wohnzimmer');
  await page.click('#modal-ok');
  const r = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { roomCalc } = await import('/src/woflv/calc.js');
    const room = state.rooms[0];
    return { n: state.rooms.length, name: room?.name, pts: room?.polygon.length,
             ortho: room ? room.polygon[0].y === room.polygon[1].y : false,
             m2: room ? roomCalc(room, state.scale * state.imgDisplayScale).anrechenbar : 0 };
  });
  expect(r.n).toBe(1);
  expect(r.name).toBe('Wohnzimmer');
  expect(r.pts).toBe(4);
  expect(r.ortho).toBe(true);           // Snap hat gegriffen
  expect(r.m2).toBeGreaterThan(1);      // plausible Fläche
  // Canvas enthält Raum-Polygon + Label
  const objs = await page.evaluate(async () => {
    const { canvas } = await import('/src/canvas.js');
    return canvas.getObjects().filter(o => o._roomId != null).length;
  });
  expect(objs).toBeGreaterThanOrEqual(2); // Polygon + Label
});

test('Neuer Plan-Load leert state.rooms (keine Kontamination durch alten Plan)', async ({ page }) => {
  await setupApp(page);
  const box = await page.locator('#c').boundingBox();
  await page.click('#btn-room');
  await page.mouse.click(box.x + 300, box.y + 200); await page.waitForTimeout(100);
  await page.mouse.click(box.x + 600, box.y + 205); await page.waitForTimeout(100);
  await page.mouse.click(box.x + 597, box.y + 400); await page.waitForTimeout(100);
  await page.mouse.dblclick(box.x + 300, box.y + 398); await page.waitForTimeout(200);
  await page.fill('#room-name', 'Wohnzimmer');
  await page.click('#modal-ok');
  const before = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.rooms.length;
  });
  expect(before).toBe(1);

  // Neuen Plan laden (gleiche Datei reicht, um den vollen Reset-Pfad zu triggern).
  // Input erst leeren, sonst feuert Chromium bei identischem Dateipfad kein
  // change-Event (Wert des <input> ändert sich sonst nicht).
  // Warten auf das Onboarding-Overlay statt fixem Timeout: es wird als letzter
  // Schritt von loadImageFromDataUrl() erzeugt, also ein zuverlässiges Fertig-Signal.
  await page.setInputFiles('#file-input', []);
  await page.setInputFiles('#file-input', DEMO);
  await page.locator('#onboarding-overlay').waitFor({ state: 'attached', timeout: 5000 });
  await page.evaluate(() => document.getElementById('onboarding-overlay')?.remove());

  const after = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { canvas } = await import('/src/canvas.js');
    return {
      rooms: state.rooms.length,
      printScale: state.printScale,
      canvasRoomObjs: canvas.getObjects().filter(o => o._roomId != null).length,
    };
  });
  expect(after.rooms).toBe(0);
  expect(after.printScale).toBe(null);
  expect(after.canvasRoomObjs).toBe(0);
});

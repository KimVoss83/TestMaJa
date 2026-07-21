import { test, expect } from '@playwright/test';
import { setupApp } from './helpers.js';

async function seedRooms(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { rebuildRooms, syncRoomIdCounter } = await import('/src/tools/room.js');
    const s = state.scale;
    state.rooms = [
      { id: 1, name: 'Wohnzimmer', kind: 'wohnflaeche', category: 'normal', balkonFaktor: 0.25,
        polygon: [{x:100,y:100},{x:100+4*s,y:100},{x:100+4*s,y:100+3*s},{x:100,y:100+3*s}],
        zones: [], deductions: [] }];
    syncRoomIdCounter(); rebuildRooms(); window.updateRoomList();
  });
}

test('CSV enthält Kopf, Raumzeile und Summen mit Dezimal-Komma', async ({ page }) => {
  await setupApp(page); await seedRooms(page);
  const csv = await page.evaluate(async () => {
    const { buildCSV } = await import('/src/io/report.js');
    const { state } = await import('/src/state.js');
    return buildCSV(state.rooms, state.scale);
  });
  expect(csv).toContain('"Raum";"Art"');
  expect(csv).toContain('Wohnzimmer');
  expect(csv).toContain('12,00');
  expect(csv).toContain('Wohnfläche gesamt');
});

test('CSV-Download über echten Klick enthält UTF-8-BOM und Rauminhalt', async ({ page }) => {
  await setupApp(page); await seedRooms(page);
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('btn-report-csv').click());
  const download = await dl;
  expect(download.suggestedFilename()).toBe('wohnflaeche.csv');
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  const buf = Buffer.concat(chunks);
  expect(buf[0]).toBe(0xEF);
  expect(buf[1]).toBe(0xBB);
  expect(buf[2]).toBe(0xBF);
  const content = buf.subarray(3).toString('utf-8');
  expect(content).toContain('Wohnzimmer');
  expect(content).toContain(';');
});

test('PDF-Bericht ist eine valide PDF-Datei', async ({ page }) => {
  await setupApp(page); await seedRooms(page);
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('btn-report-pdf').click());
  const download = await dl;
  expect(download.suggestedFilename()).toBe('wohnflaechenbericht.pdf');
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  const buf = Buffer.concat(chunks);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.length).toBeGreaterThan(10000);
});

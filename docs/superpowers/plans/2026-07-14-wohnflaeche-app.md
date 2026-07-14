# Wohnflächen-App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eigenständige Web-App `wohnflaeche/` zum Messen in Wohnungsgrundrissen mit WoFlV-konformer Wohnflächenberechnung, per Copy & Strip aus `planer/` abgeleitet.

**Architecture:** Drittes Vite-Single-File-Projekt im Repo (Muster `feldaufnahme.html`). Kern (Canvas/Undo/Mess-Tools) wird 1:1 aus `planer/src/` kopiert, Outdoor-Module entfallen. Neu: Raum-/Zonen-/Abzugs-Werkzeuge, pure WoFlV-Rechenlogik, PDF-Import mit 1:X-Kalibrierung, PDF-Bericht + CSV.

**Tech Stack:** Fabric.js 5.x + jsPDF (CDN, SRI — wie planer), PDF.js (CDN, SRI — wie feldaufnahme.html), Vite + vite-plugin-singlefile, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-14-wohnflaeche-indoor-design.md`
**Branch:** `feat/wohnflaeche` (von `main` abzweigen)

## Global Constraints

- Reine Client-App, keine neuen npm-Runtime-Dependencies; externe Libs nur per CDN-`<script>` **mit SRI-Hash** (Hashes aus `planer/index.html` bzw. `feldaufnahme.html` kopieren, niemals selbst erfinden)
- Alle Strings aus geladenen Dateien (Projekt-JSON, Dateinamen) vor `innerHTML` durch `escHtml()` (`src/utils/helpers.js`)
- UI-Texte auf Deutsch; Flächenausgaben 2 Nachkommastellen im de-DE-Format (`fmt2` aus `woflv/calc.js`)
- WoFlV-Konstanten exakt: Höhenzonen 50 % (1–2 m) / 0 % (< 1 m); Wintergarten-unbeheizt/Schwimmbad 0,5; Balkon-artige 0,25 default, clamp 0,25–0,5; Abzüge zählen nur > 0,1 m²; `kind='zubehoer'` → anrechenbar 0
- Alle Kommandos aus `wohnflaeche/` ausführen (npx/npm dort, sonst Playwright-Versionskonflikt — bekanntes Problem im Repo)
- Tests: Playwright, `testDir: './tests'`, Dev-Server via `webServer`-Config (Kopie von planer, Port 5174)
- Commit-Messages enden mit `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Projekt-Scaffold — 1:1-Kopie von planer, die baut und testet

**Files:**
- Create: `wohnflaeche/` (Kopie von `planer/` ohne node_modules/dist)
- Modify: `wohnflaeche/package.json`, `wohnflaeche/playwright.config.js`

**Interfaces:**
- Produces: lauffähiges Vite-Projekt `wohnflaeche/` mit identischem Verhalten wie planer; Port **5174**

- [ ] **Step 1: Kopieren**

```bash
cd /Users/matthiasjatzwauk/TestMaJa
git checkout main && git checkout -b feat/wohnflaeche
mkdir wohnflaeche
cp -R planer/index.html planer/vite.config.js planer/playwright.config.js \
      planer/package.json planer/package-lock.json planer/src planer/public \
      planer/tests wohnflaeche/
printf 'node_modules/\ndist/\ntest-results/\n' > wohnflaeche/.gitignore
```

- [ ] **Step 2: package.json & Port anpassen**

In `wohnflaeche/package.json`: `"name": "wohnflaeche"`.
In `wohnflaeche/playwright.config.js` beide Vorkommen von `5173` durch `5174` ersetzen und `command: 'npm run dev'` durch `command: 'npm run dev -- --port 5174'`.

- [ ] **Step 3: Installieren, bauen, testen (Baseline = grün)**

```bash
cd wohnflaeche && npm install && npm run build
CI=1 npx playwright test
```
Expected: Build erzeugt `dist/index.html`; 3/3 Tests PASS (identisch zu planer).

- [ ] **Step 4: Commit**

```bash
git add wohnflaeche && git commit -m "feat(wohnflaeche): Scaffold als Kopie von planer (Baseline grün)"
```

---

### Task 2: Outdoor-Strip — Leitungen, Photogrammetrie, Drohnen-Onboarding raus

**Files:**
- Delete: `wohnflaeche/src/tools/pipe.js`, `pipe-refs.js`, `pipe-parallel.js`, `wohnflaeche/src/ui/pipe-guides.js`, `pipe-legend.js`, `pipe-assign.js`, `materialrechner.js`, `whats-new.js`, `wohnflaeche/src/io/photogrammetry.js`, `pipe-transfer.js`, `wohnflaeche/src/onboarding/ref-onboarding.js`, `tutorial.js`
- Modify: `wohnflaeche/src/main.js`, `state.js`, `tools/tool-manager.js`, `tools/ref.js`, `ui/sidebar.js`, `io/save-load.js`, `io/image-loader.js`, `index.html`
- Test: `wohnflaeche/tests/smoke.spec.js` (neu), `wohnflaeche/tests/pdf-export.spec.js` (angepasst)

**Interfaces:**
- Produces: entschlackte App; `updateRefStatus()` ohne Photogrammetrie; `setTool(t)` ohne `pipe`; Smoke-Test als Regressions-Harness für alle Folge-Tasks

- [ ] **Step 1: Regressions-Smoke-Test schreiben (vor dem Strip)**

`wohnflaeche/tests/smoke.spec.js` — prüft die Werkzeuge, die überleben müssen:

```js
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.join(__dirname, '..', 'public', 'demo-plan.jpg');

// Hilfsfunktion: App laden, Onboarding weg, Maßstab programmatisch setzen (600px = 10m)
export async function setupApp(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('/');
  await page.waitForFunction(() => window.fabric && window.jspdf, null, { timeout: 20000 });
  await page.setInputFiles('#file-input', DEMO);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20000 });
  await page.locator('#onboarding-overlay').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('onboarding-overlay')?.remove());
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const ref = await import('/src/tools/ref.js');
    const pxLen = 600 / state.imgDisplayScale;
    state.refLines.push({ pxLen, realLen_m: 10 });
    state.scale = pxLen / 10; state.scaleSource = 'ref';
    ref.updateRefStatus();
  });
  return errors;
}

test('Kern-Werkzeuge funktionieren ohne Runtime-Fehler', async ({ page }) => {
  const errors = await setupApp(page);
  const box = await page.locator('#c').boundingBox();
  const P = async (x, y) => { await page.mouse.click(box.x + x, box.y + y); await page.waitForTimeout(100); };

  await page.click('#btn-distance'); await P(200, 250); await P(800, 250);
  await page.click('#btn-area'); await P(200, 320); await P(500, 320); await P(500, 450);
  await page.mouse.dblclick(box.x + 200, box.y + 450); await page.waitForTimeout(150);
  await page.click('#btn-circle'); await P(700, 350); await P(760, 350);
  await page.click('#btn-select'); await page.click('#btn-undo'); await page.click('#btn-redo');

  const n = await page.evaluate(async () => (await import('/src/state.js')).state.measurements.length);
  expect(n).toBeGreaterThanOrEqual(3);
  expect(errors, errors.join('\n')).toEqual([]);
});
```

- [ ] **Step 2: Smoke-Test läuft auf der Baseline**

```bash
CI=1 npx playwright test smoke
```
Expected: PASS (Kopie verhält sich wie planer).

- [ ] **Step 3: Module löschen**

```bash
cd wohnflaeche
rm src/tools/pipe.js src/tools/pipe-refs.js src/tools/pipe-parallel.js \
   src/ui/pipe-guides.js src/ui/pipe-legend.js src/ui/pipe-assign.js \
   src/ui/materialrechner.js src/ui/whats-new.js \
   src/io/photogrammetry.js src/io/pipe-transfer.js \
   src/onboarding/ref-onboarding.js src/onboarding/tutorial.js
```

- [ ] **Step 4: Referenzen ausbauen — grep-getrieben, bis der Build grün ist**

Reihenfolge: erst `main.js`, dann die restlichen Module, dann `index.html`.

```bash
grep -n "pipe\|Pipe\|Leitungen\|parallel\|Parallel\|photogrammetry\|Photogrammetrie\|materialrechner\|Materialrechner\|whats-new\|whatsNew\|tutorial\|Tutorial\|ref-onboarding\|showRefOnboarding\|pipeTransfer\|PIPE_TYPES" \
  src/main.js src/state.js src/tools/tool-manager.js src/tools/ref.js \
  src/ui/sidebar.js src/ui/statusbar.js src/io/save-load.js src/io/image-loader.js src/mobile/*.js
```

Für jeden Treffer: Import-Zeile, Aufruf oder Codeblock entfernen. Konkret bekannt:

1. **`state.js`**: Felder `pipes`, `pipeType`, `pipeRefMode`, `pipeRefTempPt`, `assignModePipeId`, `editingPipe` und den Export `PIPE_TYPES` löschen.
2. **`tool-manager.js`**: In `TOOL_NAMES`/`TOOL_HINTS` den Eintrag `pipe` löschen; Import `PIPE_TYPES` löschen; `initPipeSelect()`- und `initMobilePipeBar()`-IIFEs komplett löschen; in `setTool()` die Blöcke zu `pipe-type-group`, `mobile-pipe-bar`, `pipeRefMode` löschen; `'pipe'` aus `HELPER_TOOLS`, `REF_TOOLS`, `_MOB_OB_TOOLS` entfernen.
3. **`tools/ref.js`**: Import aus `../io/photogrammetry.js` löschen. `updateRefStatus()` durch diese Version ersetzen (else-Zweig „Maßstab nicht gesetzt“ und Grid-Info-Block unverändert lassen):

```js
export function updateRefStatus() {
  const statusRef = document.getElementById('status-ref');
  const refStatus = document.getElementById('ref-status');
  if (state.scale) {
    const cmPerPx = 100 / state.scale;
    const n = state.refLines.length;
    const sourceLabel = state.scaleSource === 'pdf'
      ? `Maßstab 1:${state.printScale}`
      : `${n} Ref${n > 1 ? 'erenzen' : 'erenz'}`;
    refStatus.innerHTML =
      `<div class="ref-status-row"><div class="ref-status-main">` +
      `<span class="ref-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> ${sourceLabel}</span>` +
      `<span class="ref-metrics"><b>${cmPerPx.toFixed(2)} cm/px</b></span>` +
      `</div></div>`;
    statusRef.innerHTML = `Maßstab: <b style="color:#1d1d1f">${cmPerPx.toFixed(2)} cm/px</b>`;
    statusRef.style.color = '';
  } else { /* … bestehender else-Zweig unverändert … */ }
  updateMeasureButtons();
  /* … bestehender Grid-Info-Block unverändert … */
}
```

4. **`main.js`**: alle Imports aus gelöschten Modulen; `case 'pipe':` im Tool-Switch; Aufrufe `handlePipeRefClick`, `handleParallelClick`, `applyParallelSnap`, `handleLeitungenAlignClick`, `toggleRefAssignment`, `clearPipeDistanceGuides`, `endPipeEdit`-Blöcke, `showRefOnboarding`-Aufruf, Legend-/Transfer-/Materialrechner-Verdrahtung. Wo ein `if (…) return;` einen gelöschten Handler aufruft, die ganze if-Anweisung löschen.
5. **`sidebar.js` / `save-load.js` / `image-loader.js` / `mobile/*.js`**: analog alle Treffer entfernen (Leitungs-Akkordeon-Rendering, pipes-Serialisierung, EXIF→showRefOnboarding-Weiterleitung).
6. **`index.html`**: Elemente mit diesen IDs samt zugehöriger `<script>`-freier Markup-Blöcke löschen: `btn-pipe`, `pipe-type-group`, `pipe-type-select`, `btn-pipe-ref-line`, `btn-pipe-ref-point`, `btn-pipe-layer-toggle`, `btn-parallel-snap`, `mobile-pipe-bar`, `acc-leitungen`, `badge-leitungen`, `leitungen-import-input`, `btn-whats-new`, `btn-how-it-works` sowie Materialrechner-Markup (per `grep -n "materialrechner\|Material" index.html` finden). Inline-`onclick`s auf gelöschte window-Funktionen mitlöschen.

Nach jeder Datei: `npm run build` — Vite meldet die nächste ungelöste Referenz mit Datei+Zeile. Iterieren bis:

```bash
npm run build
```
Expected: `✓ built` ohne Fehler.

- [ ] **Step 5: Tests anpassen und laufen lassen**

In `tests/pdf-export.spec.js` den dritten Test (Messungs-Label-XSS) unverändert lassen; er nutzt nur `sidebar.updateMeasurementList` — falls `updateMeasurementList` beim Strip Leitungs-Code verlor, bleibt die Messungs-Liste erhalten.

```bash
CI=1 npx playwright test
```
Expected: 4/4 PASS (3 übernommene + smoke). Zusätzlich manuell: `npm run dev -- --port 5174`, App im Browser öffnen — keine Konsolen-Fehler, Bild laden + Distanz messen funktioniert.

- [ ] **Step 6: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): Outdoor-Module entfernt, Kern-App läuft (smoke grün)"
```

---

### Task 3: WoFlV-Rechenkern `woflv/calc.js`

**Files:**
- Create: `wohnflaeche/src/woflv/calc.js`
- Test: `wohnflaeche/tests/woflv.spec.js`

**Interfaces:**
- Produces (von allen Folge-Tasks genutzt):
  - `shoelace(pts: {x,y}[]): number` (px²)
  - `pointInPolygon(p: {x,y}, poly: {x,y}[]): boolean`
  - `intersectionArea(polyA, polyB): number` (px², Rastersampling ~±0,5 %)
  - `roomCalc(room, scale): { roh, abzugSum, zone50, zone0, faktor, anrechenbar }` (alles m²)
  - `totals(rooms, scale): { perRoom: [{room, calc}], wohnflaeche, nutzflaeche }`
  - `scaleFromPrintScale(ratioX, pageWidthPt, renderedWidthPx): number` (px/m)
  - `fmt2(v): string` (de-DE, 2 Dezimalen), `BALKON_KATEGORIEN`, `MIN_ABZUG_M2`

- [ ] **Step 1: Failing Tests schreiben** — `wohnflaeche/tests/woflv.spec.js`:

```js
import { test, expect } from '@playwright/test';

async function calc(page) {
  await page.goto('/');
  return (fn, ...args) => page.evaluate(
    async ({ fn, args }) => {
      const m = await import('/src/woflv/calc.js');
      return m[fn](...args);
    }, { fn, args });
}

// Rechteck 400×300 px, scale 100 px/m → 4×3 m = 12 m²
const RECT = [{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}];
const room = (over = {}) => ({ id:1, name:'Test', kind:'wohnflaeche', category:'normal',
  balkonFaktor:0.25, polygon:RECT, zones:[], deductions:[], ...over });

test('Rohfläche: Shoelace + scale²', async ({ page }) => {
  const c = await calc(page);
  expect(await c('shoelace', RECT)).toBe(120000);
  const r = await c('roomCalc', room(), 100);
  expect(r.roh).toBeCloseTo(12, 5);
  expect(r.anrechenbar).toBeCloseTo(12, 5);
});

test('50%-Zone reduziert anrechenbare Fläche', async ({ page }) => {
  const c = await calc(page);
  // Zone = halber Raum (400×150) → 6 m² · 0,5 = 3 m² → gesamt 6 + 3 = 9 m²
  const z = [{x:0,y:0},{x:400,y:0},{x:400,y:150},{x:0,y:150}];
  const r = await c('roomCalc', room({ zones:[{ polygon:z, height:'1bis2m' }] }), 100);
  expect(r.zone50).toBeCloseTo(6, 1);
  expect(r.anrechenbar).toBeCloseTo(9, 1);
});

test('0%-Zone zählt gar nicht', async ({ page }) => {
  const c = await calc(page);
  const z = [{x:0,y:0},{x:400,y:0},{x:400,y:150},{x:0,y:150}];
  const r = await c('roomCalc', room({ zones:[{ polygon:z, height:'unter1m' }] }), 100);
  expect(r.anrechenbar).toBeCloseTo(6, 1);
});

test('Zone wird am Raum geclippt', async ({ page }) => {
  const c = await calc(page);
  // Zone ragt komplett rechts raus: nur die Hälfte liegt im Raum
  const z = [{x:200,y:0},{x:600,y:0},{x:600,y:300},{x:200,y:300}];
  const r = await c('roomCalc', room({ zones:[{ polygon:z, height:'unter1m' }] }), 100);
  expect(r.zone0).toBeCloseTo(6, 1);   // nicht 12
});

test('Abzug ≤ 0,1 m² wird ignoriert (§3(3))', async ({ page }) => {
  const c = await calc(page);
  const small = [{x:0,y:0},{x:30,y:0},{x:30,y:30},{x:0,y:30}];   // 0,09 m²
  const big   = [{x:100,y:100},{x:150,y:100},{x:150,y:150},{x:100,y:150}]; // 0,25 m²
  const r = await c('roomCalc', room({ deductions:[{polygon:small,label:'s'},{polygon:big,label:'b'}] }), 100);
  expect(r.abzugSum).toBeCloseTo(0.25, 2);
});

test('Balkonfaktor: default 0,25 und Clamp auf 0,5', async ({ page }) => {
  const c = await calc(page);
  const b = await c('roomCalc', room({ category:'balkon' }), 100);
  expect(b.anrechenbar).toBeCloseTo(3, 5);          // 12 · 0,25
  const b2 = await c('roomCalc', room({ category:'balkon', balkonFaktor:0.9 }), 100);
  expect(b2.anrechenbar).toBeCloseTo(6, 5);         // clamp 0,5
});

test('Zubehör zählt 0, erscheint als Nutzfläche', async ({ page }) => {
  const c = await calc(page);
  const t = await c('totals', [room(), room({ id:2, kind:'zubehoer', name:'Keller' })], 100);
  expect(t.wohnflaeche).toBeCloseTo(12, 5);
  expect(t.nutzflaeche).toBeCloseTo(12, 5);
});

test('scaleFromPrintScale: A4 quer 1:100', async ({ page }) => {
  const c = await calc(page);
  // A4-Breite 595,28 pt = 0,20999 m Papier → bei 1:100 = 20,999 m real; 2380 px gerendert
  expect(await c('scaleFromPrintScale', 100, 595.28, 2380)).toBeCloseTo(113.34, 1);
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

```bash
CI=1 npx playwright test woflv
```
Expected: FAIL — `Failed to fetch dynamically imported module …/src/woflv/calc.js`.

- [ ] **Step 3: Implementieren** — `wohnflaeche/src/woflv/calc.js`:

```js
// =========================================================
// WoFlV-Rechenlogik — pure functions, kein DOM, kein Canvas.
// Polygone in Canvas-px; scale = px pro Meter → Ergebnisse in m².
// =========================================================
export const BALKON_KATEGORIEN = ['balkon', 'loggia', 'terrasse', 'dachgarten'];
export const KATEGORIE_FAKTOR = { 'normal': 1.0, 'wintergarten-unbeh': 0.5, 'schwimmbad': 0.5 };
export const MIN_ABZUG_M2 = 0.1;   // §3(3): kleinere Abzüge zählen nicht

export function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Fläche von A ∩ B per Rastersampling über die BBox von A.
// Exakte Fläche von A × Trefferquote → Fehler < ~0,5 % bei 300er-Raster.
export function intersectionArea(polyA, polyB) {
  const xs = polyA.map(p => p.x), ys = polyA.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const step = Math.max(maxX - minX, maxY - minY) / 300;
  if (!(step > 0)) return 0;
  let hits = 0, total = 0;
  for (let x = minX + step / 2; x < maxX; x += step)
    for (let y = minY + step / 2; y < maxY; y += step) {
      const p = { x, y };
      if (pointInPolygon(p, polyA)) { total++; if (pointInPolygon(p, polyB)) hits++; }
    }
  return total === 0 ? 0 : shoelace(polyA) * (hits / total);
}

export function roomCalc(room, scale) {
  const px2m2 = v => v / (scale * scale);
  const roh = px2m2(shoelace(room.polygon));

  const abzuege = (room.deductions || []).map(d =>
    ({ ...d, area_m2: px2m2(intersectionArea(d.polygon, room.polygon)) }));
  const abzugSum = abzuege.filter(d => d.area_m2 > MIN_ABZUG_M2)
                          .reduce((s, d) => s + d.area_m2, 0);
  const basis = Math.max(0, roh - abzugSum);

  let zone50 = 0, zone0 = 0;
  for (const z of room.zones || []) {
    const a = px2m2(intersectionArea(z.polygon, room.polygon));
    if (z.height === '1bis2m') zone50 += a; else zone0 += a;
  }
  zone50 = Math.min(zone50, basis);
  zone0  = Math.min(zone0, Math.max(0, basis - zone50));

  const hoehen = (basis - zone50 - zone0) + 0.5 * zone50;
  const faktor = BALKON_KATEGORIEN.includes(room.category)
    ? Math.min(0.5, Math.max(0.25, room.balkonFaktor ?? 0.25))
    : (KATEGORIE_FAKTOR[room.category] ?? 1);
  const anrechenbar = room.kind === 'zubehoer' ? 0 : hoehen * faktor;
  return { roh, abzugSum, zone50, zone0, faktor, anrechenbar, abzuege };
}

export function totals(rooms, scale) {
  let wohnflaeche = 0, nutzflaeche = 0;
  const perRoom = (rooms || []).map(r => {
    const c = roomCalc(r, scale);
    if (r.kind === 'zubehoer') nutzflaeche += c.roh; else wohnflaeche += c.anrechenbar;
    return { room: r, calc: c };
  });
  return { perRoom, wohnflaeche, nutzflaeche };
}

// PDF-Kalibrierung: Papierbreite (pt) + aufgedruckter Maßstab 1:X → px/m
export function scaleFromPrintScale(ratioX, pageWidthPt, renderedWidthPx) {
  const paperWidth_m = pageWidthPt / 72 * 0.0254;
  return renderedWidthPx / (paperWidth_m * ratioX);
}

export const fmt2 = v =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

- [ ] **Step 4: Tests laufen lassen**

```bash
CI=1 npx playwright test woflv
```
Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add wohnflaeche/src/woflv wohnflaeche/tests/woflv.spec.js
git commit -m "feat(wohnflaeche): WoFlV-Rechenkern mit Unit-Tests"
```

---

### Task 4: Raum-Werkzeug `tools/room.js`

**Files:**
- Create: `wohnflaeche/src/tools/room.js`
- Modify: `wohnflaeche/src/state.js`, `src/tools/tool-manager.js`, `src/main.js`, `wohnflaeche/index.html`
- Test: `wohnflaeche/tests/room.spec.js`

**Interfaces:**
- Consumes: `roomCalc/fmt2` aus Task 3; `createModal`, `addLabel`, `saveSnapshot`, `setTool`-Mechanik aus dem Kern
- Produces:
  - `handleRoomClick(p)`, `handleRoomDblClick(p)`, `cancelRoomDraft()` — von main.js aufgerufen
  - `rebuildRooms()` — löscht alle Fabric-Objekte mit `_roomId` und zeichnet `state.rooms` neu (Polygone, Zonen-Schraffuren, Abzüge, Labels); wird von zone.js, save-load, raumliste genutzt
  - `ROOM_COLORS[category]` — Füllfarben
  - state-Erweiterung: `state.rooms = []`, `state.roomDraft = []`, `state.roomSnap = true`, `state.printScale = null`

- [ ] **Step 1: Failing Test** — `wohnflaeche/tests/room.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { setupApp } from './smoke.spec.js';

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
             m2: room ? roomCalc(room, state.scale).anrechenbar : 0 };
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
```

- [ ] **Step 2: Test fehlschlagen sehen**

```bash
CI=1 npx playwright test room
```
Expected: FAIL — `#btn-room` nicht gefunden.

- [ ] **Step 3: state.js erweitern** (an die bestehenden Feld-Deklarationen anfügen):

```js
  rooms: [],          // Wohnflächen-Räume (siehe Spec-Datenmodell)
  roomDraft: [],      // Punkte des aktuell gezeichneten Raum-Polygons
  roomSnap: true,     // 90°-Snap default AN (Shift = frei)
  printScale: null,   // 1:X aus PDF-Kalibrierung (nur Anzeige)
  pdfPage: null,      // { widthPt, heightPt, renderedWidthPx } nach PDF-Import
```

- [ ] **Step 4: `tools/room.js` implementieren:**

```js
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

export function handleRoomDblClick() {
  if (state.roomDraft.length < 3) { cancelRoomDraft(); return; }
  const polygon = state.roomDraft.slice();
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
```

- [ ] **Step 5: Verdrahten**

`tool-manager.js`: in `TOOL_NAMES` ergänzen `room: 'Raum', zone: 'Zone', deduction: 'Abzug'`; in `TOOL_HINTS` ergänzen `room: 'Eckpunkte klicken → Doppelklick schließt · Shift = 90°-Snap aus'`, `zone: 'In einen Raum klicken, Zone umranden → Doppelklick'`, `deduction: 'Pfeiler/Kamin im Raum umranden → Doppelklick'`; `MEASURE_TOOLS` um `'room','zone','deduction'` erweitern (Maßstab-Gate) und in `updateMeasureButtons` für die drei neuen IDs Titel `'Zuerst Referenzmaß setzen!'`/Werkzeugtitel analog ergänzen.

`main.js`:
- Import: `import { handleRoomClick, handleRoomDblClick, cancelRoomDraft, rebuildRooms } from './tools/room.js';`
- Tool-Switch: `case 'room': handleRoomClick(p, opt.e); break;`
- `mouse:dblclick`-Handler: `if (state.tool === 'room') { handleRoomDblClick(); return; }`
- In der bestehenden `cancelDrawing`-Funktion `cancelRoomDraft();` ergänzen.

`index.html`: neben `btn-area` einen Button einfügen (Icon-Stil der Nachbar-Buttons kopieren):

```html
<button id="btn-room" title="Raum erfassen (WoFlV)"><span class="btn-icon">▢</span> Raum</button>
<button id="btn-zone" title="Höhenzone (Dachschräge)"><span class="btn-icon">◩</span> Zone</button>
<button id="btn-deduction" title="Abzugsfläche (Pfeiler, Kamin)"><span class="btn-icon">▨</span> Abzug</button>
```

- [ ] **Step 6: Tests laufen lassen**

```bash
CI=1 npx playwright test room smoke
```
Expected: alle PASS.

- [ ] **Step 7: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): Raum-Werkzeug mit 90°-Snap und Kategorien"
```

---

### Task 5: Raumliste in der Sidebar `ui/raumliste.js`

**Files:**
- Create: `wohnflaeche/src/ui/raumliste.js`
- Modify: `wohnflaeche/index.html` (Akkordeon), `wohnflaeche/src/main.js` (Init)
- Test: `wohnflaeche/tests/raumliste.spec.js`

**Interfaces:**
- Consumes: `totals`, `fmt2`, `BALKON_KATEGORIEN` (Task 3); `rebuildRooms` (Task 4); `escHtml`, `createModal`, `saveSnapshot`
- Produces: `updateRoomList()` (auch als `window.updateRoomList` für room.js/zone.js/save-load)

- [ ] **Step 1: Failing Test** — `wohnflaeche/tests/raumliste.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { setupApp } from './smoke.spec.js';

async function addRoomsProgrammatically(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { rebuildRooms, syncRoomIdCounter } = await import('/src/tools/room.js');
    const s = state.scale; // px/m
    const rect = (x, y, wM, hM) => [
      { x, y }, { x: x + wM * s, y }, { x: x + wM * s, y: y + hM * s }, { x, y: y + hM * s }];
    state.rooms = [
      { id: 1, name: 'Wohnzimmer', kind: 'wohnflaeche', category: 'normal',
        balkonFaktor: 0.25, polygon: rect(100, 100, 4, 3), zones: [], deductions: [] },
      { id: 2, name: 'Balkon', kind: 'wohnflaeche', category: 'balkon',
        balkonFaktor: 0.25, polygon: rect(600, 100, 2, 2), zones: [], deductions: [] },
      { id: 3, name: 'Keller', kind: 'zubehoer', category: 'normal',
        balkonFaktor: 0.25, polygon: rect(100, 500, 2, 2), zones: [], deductions: [] },
    ];
    syncRoomIdCounter(); rebuildRooms(); window.updateRoomList();
  });
}

test('Raumliste zeigt Räume und korrekte Summen', async ({ page }) => {
  await setupApp(page);
  await addRoomsProgrammatically(page);
  const list = page.locator('#room-list');
  await expect(list).toContainText('Wohnzimmer');
  await expect(list).toContainText('Balkon');
  await expect(list).toContainText('Keller');
  // Wohnfläche = 12 + 4·0,25 = 13,00 m²; Nutzfläche = 4,00 m²
  await expect(page.locator('#room-sums')).toContainText('13,00');
  await expect(page.locator('#room-sums')).toContainText('4,00');
  await expect(page.locator('#badge-raeume')).toHaveText('3');
});

test('XSS: bösartiger Raumname wird escaped', async ({ page }) => {
  await setupApp(page);
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    state.rooms = [{ id: 1, name: '<img src=x onerror="window.__xss=1">',
      kind: 'wohnflaeche', category: 'normal', balkonFaktor: 0.25,
      polygon: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], zones: [], deductions: [] }];
    window.updateRoomList();
  });
  const html = await page.evaluate(() => document.getElementById('room-list').innerHTML);
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img src=x onerror');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
```

- [ ] **Step 2: Fehlschlag verifizieren** — `CI=1 npx playwright test raumliste` → FAIL (`#room-list` fehlt).

- [ ] **Step 3: Akkordeon in `index.html`** — an der Stelle des früheren Leitungen-Akkordeons, exakt im Markup-Stil der Nachbar-Sektionen (`acc-messungen` als Vorlage kopieren):

```html
<div class="acc-section" id="acc-raeume">
  <div class="acc-head">Räume <span class="acc-badge" id="badge-raeume">0</span></div>
  <div class="acc-body">
    <div id="room-list"></div>
    <div id="room-sums" style="position:sticky;bottom:0;background:inherit;
         border-top:1px solid rgba(0,0,0,0.1);padding:6px 0;font-weight:600;"></div>
  </div>
</div>
```

- [ ] **Step 4: `ui/raumliste.js` implementieren:**

```js
import { state } from '../state.js';
import { saveSnapshot } from '../undo.js';
import { escHtml } from '../utils/helpers.js';
import { createModal } from './modals.js';
import { totals, fmt2, BALKON_KATEGORIEN } from '../woflv/calc.js';
import { rebuildRooms, ROOM_COLORS } from '../tools/room.js';

const KIND_LABEL = { wohnflaeche: '', zubehoer: ' (Zubehör)' };

export function updateRoomList() {
  const list = document.getElementById('room-list');
  const sums = document.getElementById('room-sums');
  const badge = document.getElementById('badge-raeume');
  if (!list) return;
  const t = totals(state.rooms, state.scale || 1);
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
```

- [ ] **Step 5: In `main.js`** nach der Sidebar-Init ergänzen: `import { updateRoomList } from './ui/raumliste.js';` und einmalig `updateRoomList();` aufrufen.

- [ ] **Step 6: Tests** — `CI=1 npx playwright test raumliste room smoke` → alle PASS.

- [ ] **Step 7: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): Raumliste mit WoFlV-Summen und XSS-Test"
```

---

### Task 6: Zonen- & Abzugs-Werkzeug `tools/zone.js`

**Files:**
- Create: `wohnflaeche/src/tools/zone.js`
- Modify: `wohnflaeche/src/main.js` (Switch-Cases, dblclick, cancelDrawing)
- Test: `wohnflaeche/tests/zone.spec.js`

**Interfaces:**
- Consumes: `pointInPolygon`, `MIN_ABZUG_M2`, `roomCalc` (Task 3); `rebuildRooms` (Task 4); `updateRoomList` (Task 5)
- Produces: `handleZoneClick(p, mode)` mit `mode: 'zone' | 'deduction'`, `handleZoneDblClick(mode)`, `cancelZoneDraft()`

- [ ] **Step 1: Failing Test** — `wohnflaeche/tests/zone.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { setupApp } from './smoke.spec.js';

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
```

- [ ] **Step 2: Fehlschlag verifizieren** — `CI=1 npx playwright test zone` → FAIL.

- [ ] **Step 3: `tools/zone.js` implementieren:**

```js
import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addEndpointDot, snapToPixel } from '../utils/helpers.js';
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

export function handleZoneDblClick(mode) {
  if (_draft.length < 3 || !_targetRoom) { cancelZoneDraft(); return; }
  const polygon = _draft.slice();
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
        const a = intersectionArea(polygon, room.polygon) / (state.scale * state.scale);
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
```

- [ ] **Step 4: In `main.js` verdrahten:** Import ergänzen; Tool-Switch: `case 'zone': handleZoneClick(p, 'zone'); break; case 'deduction': handleZoneClick(p, 'deduction'); break;`; dblclick-Handler: `if (state.tool === 'zone' || state.tool === 'deduction') { handleZoneDblClick(state.tool === 'zone' ? 'zone' : 'deduction'); return; }`; `cancelZoneDraft()` in `cancelDrawing` ergänzen.

- [ ] **Step 5: Tests** — `CI=1 npx playwright test zone woflv room raumliste smoke` → alle PASS.

- [ ] **Step 6: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): Höhenzonen- und Abzugs-Werkzeug"
```

---

### Task 7: PDF-Import `io/pdf-import.js`

**Files:**
- Create: `wohnflaeche/src/io/pdf-import.js`, `wohnflaeche/tests/fixtures/make-fixture.mjs`, `wohnflaeche/tests/fixtures/grundriss.pdf` (generiert)
- Modify: `wohnflaeche/index.html` (PDF.js-CDN + accept), `wohnflaeche/src/main.js` (Datei-Routing)
- Test: `wohnflaeche/tests/pdf-import.spec.js`

**Interfaces:**
- Consumes: bestehenden Bild-Lade-Pfad aus `io/image-loader.js` (Funktion, die der `#file-input`-Handler in main.js für Bilder aufruft — per `grep -n "file-input" src/main.js` identifizieren)
- Produces: `isPdfFile(file): boolean`; `loadPdfFile(file): Promise<{dataUrl, widthPt, heightPt, renderedWidthPx}>`; setzt `state.pdfPage`

- [ ] **Step 1: Fixture-Generator schreiben** — `wohnflaeche/tests/fixtures/make-fixture.mjs`:

```js
// Erzeugt eine einseitige A4-PDF mit einem einfachen Grundriss-Rechteck.
// Aufruf: node tests/fixtures/make-fixture.mjs
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(`<div style="width:500px;height:350px;border:3px solid #000;
  margin:80px;position:relative;font-family:sans-serif;">
  <div style="position:absolute;top:10px;left:10px;">Grundriss-Fixture · Maßstab 1:100</div></div>`);
await p.pdf({ path: 'tests/fixtures/grundriss.pdf', format: 'A4' });
await b.close();
console.log('fixture geschrieben');
```

```bash
node tests/fixtures/make-fixture.mjs && ls -la tests/fixtures/grundriss.pdf
```
Expected: Datei existiert, > 5 KB.

- [ ] **Step 2: Failing Test** — `wohnflaeche/tests/pdf-import.spec.js`:

```js
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(__dirname, 'fixtures', 'grundriss.pdf');

test('PDF laden → Hintergrundbild + pdfPage-Metadaten', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => window.fabric && window.pdfjsLib, null, { timeout: 20000 });
  await page.setInputFiles('#file-input', PDF);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20000 });
  const st = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return { hasBg: !!state.backgroundImage, pdf: state.pdfPage };
  });
  expect(st.hasBg).toBe(true);
  expect(st.pdf.widthPt).toBeGreaterThan(500);       // A4: 595 pt
  expect(st.pdf.renderedWidthPx).toBeGreaterThan(1500);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Fehlschlag verifizieren** — `CI=1 npx playwright test pdf-import` → FAIL (`window.pdfjsLib` undefined).

- [ ] **Step 4: PDF.js einbinden** — Script-Tag **exakt aus `feldaufnahme.html` kopieren** (inkl. `integrity`- und `crossorigin`-Attribut):

```bash
grep -n "pdf.js\|pdfjs" ../feldaufnahme.html
```
Den gefundenen `<script>`-Tag (pdf.min.js + worker-Konfiguration) in `wohnflaeche/index.html` neben die fabric/jsPDF-Tags übernehmen. Im `#file-input` und der Drop-Zone `accept=".pdf,image/*"` bzw. bestehende accept-Liste um `.pdf` erweitern.

- [ ] **Step 5: `io/pdf-import.js` implementieren:**

```js
import { state } from '../state.js';
import { createModal, showToast } from '../ui/modals.js';

export function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function renderPage(pdf, pageNo, targetWidthPx) {
  const page = await pdf.getPage(pageNo);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / vp1.width;
  const vp = page.getViewport({ scale });
  const cnv = document.createElement('canvas');
  cnv.width = Math.round(vp.width); cnv.height = Math.round(vp.height);
  await page.render({ canvasContext: cnv.getContext('2d'), viewport: vp }).promise;
  return { dataUrl: cnv.toDataURL('image/jpeg', 0.92),
           widthPt: vp1.width, heightPt: vp1.height, renderedWidthPx: cnv.width };
}

async function pickPage(pdf) {
  if (pdf.numPages === 1) return 1;
  // Thumbnails rendern und im Modal anbieten
  const thumbs = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 12); i++)
    thumbs.push(await renderPage(pdf, i, 120));
  return new Promise(resolve => {
    createModal('Seite wählen',
      `<div style="display:flex;flex-wrap:wrap;gap:8px;">` +
      thumbs.map((t, i) =>
        `<img src="${t.dataUrl}" data-page="${i + 1}" class="pdf-thumb"
              style="width:120px;border:2px solid #d1d5db;border-radius:6px;cursor:pointer;" />`).join('') +
      `</div>`,
      () => resolve(parseInt(document.querySelector('.pdf-thumb.sel')?.dataset.page || '1')),
      () => resolve(1));
    setTimeout(() => document.querySelectorAll('.pdf-thumb').forEach(el => {
      el.onclick = () => {
        document.querySelectorAll('.pdf-thumb').forEach(x => { x.classList.remove('sel'); x.style.borderColor = '#d1d5db'; });
        el.classList.add('sel'); el.style.borderColor = '#8B3DFF';
      };
    }), 50);
  });
}

export async function loadPdfFile(file) {
  const buf = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  } catch (e) {
    showToast('PDF konnte nicht gelesen werden (beschädigt oder geschützt).');
    throw e;
  }
  const pageNo = await pickPage(pdf);
  const r = await renderPage(pdf, pageNo, 2400);
  state.pdfPage = { widthPt: r.widthPt, heightPt: r.heightPt, renderedWidthPx: r.renderedWidthPx };
  return r;
}
```

- [ ] **Step 6: In `main.js` routen** — im `#file-input`/-Drop-Handler **vor** dem Bild-Pfad:

```js
import { isPdfFile, loadPdfFile } from './io/pdf-import.js';
// … im Datei-Handler:
if (isPdfFile(file)) {
  loadPdfFile(file).then(({ dataUrl }) => {
    // dieselbe Funktion aufrufen, die der Bild-Pfad mit einem DataURL/File nutzt.
    // grep -n "readAsDataURL\|fromURL" src/io/image-loader.js zeigt den Einstieg —
    // die dortige Lade-Funktion mit dataUrl statt File-Reader-Ergebnis aufrufen.
  }).catch(() => {});
  return;
}
```
(Der exakte Funktionsname stammt aus `image-loader.js` — beim Strip in Task 2 unangetastet; typischerweise eine `loadImage(dataUrl, fileName)`-artige Funktion. Mit dem grep identifizieren und hier einsetzen. Bild-Pfad selbst nicht verändern.)

- [ ] **Step 7: Tests** — `CI=1 npx playwright test pdf-import smoke` → PASS. Fixture-PDF committen (klein, deterministisch).

- [ ] **Step 8: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): PDF-Import mit PDF.js, Seitenwahl und Fixture"
```

---

### Task 8: Kalibrierungs-Onboarding (PDF 1:X + Referenzlinie)

**Files:**
- Create: `wohnflaeche/src/onboarding/scale-onboarding.js`
- Modify: `wohnflaeche/src/main.js` (nach Bild-/PDF-Load aufrufen)
- Test: `wohnflaeche/tests/calibration.spec.js`

**Interfaces:**
- Consumes: `scaleFromPrintScale` (Task 3), `state.pdfPage` (Task 7), `updateRefStatus` (ref.js), `setTool`
- Produces: `showScaleOnboarding()` — Overlay `#onboarding-overlay` (gleiche ID wie bisher, damit Tests/Verhalten konsistent bleiben)

- [ ] **Step 1: Failing Test** — `wohnflaeche/tests/calibration.spec.js`:

```js
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF = path.join(__dirname, 'fixtures', 'grundriss.pdf');

test('PDF → 1:100 wählen → Maßstab exakt gesetzt', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.fabric && window.pdfjsLib, null, { timeout: 20000 });
  await page.setInputFiles('#file-input', PDF);
  await expect(page.locator('#drop-overlay')).toHaveClass(/hidden/, { timeout: 20000 });
  await page.locator('#onboarding-overlay').waitFor({ state: 'visible', timeout: 10000 });
  await page.click('#ob-scale-100');
  const st = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { scaleFromPrintScale } = await import('/src/woflv/calc.js');
    const expected = scaleFromPrintScale(100, state.pdfPage.widthPt, state.pdfPage.renderedWidthPx);
    return { scale: state.scale, expected, source: state.scaleSource, print: state.printScale };
  });
  expect(st.scale).toBeCloseTo(st.expected, 5);
  expect(st.source).toBe('pdf');
  expect(st.print).toBe(100);
  // Overlay weg, Mess-Buttons freigeschaltet
  await expect(page.locator('#onboarding-overlay')).toHaveCount(0);
  const gated = await page.evaluate(() =>
    document.getElementById('btn-distance').classList.contains('needs-ref'));
  expect(gated).toBe(false);
});
```

- [ ] **Step 2: Fehlschlag verifizieren** — `CI=1 npx playwright test calibration` → FAIL (kein Overlay / `#ob-scale-100` fehlt).

- [ ] **Step 3: `onboarding/scale-onboarding.js` implementieren:**

```js
import { state } from '../state.js';
import { scaleFromPrintScale } from '../woflv/calc.js';
import { updateRefStatus } from '../tools/ref.js';
import { setTool } from '../tools/tool-manager.js';

export function showScaleOnboarding() {
  document.getElementById('onboarding-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.4);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    display:flex;align-items:center;justify-content:center;z-index:2000;`;
  const isPdf = !!state.pdfPage;
  const card = document.createElement('div');
  card.style.cssText = `background:#fff;border-radius:20px;padding:28px 26px 22px;width:390px;
    max-width:95vw;box-shadow:0 40px 100px rgba(0,0,0,0.22);font-family:-apple-system,sans-serif;`;
  card.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:18px;font-weight:700;color:#1d1d1f;">Maßstab festlegen</div>
      <div style="font-size:12px;color:#636366;margin-top:4px;">
        ${isPdf ? 'Aufgedruckten Maßstab wählen oder Referenzlinie zeichnen.'
                : 'Referenzlinie über eine bekannte Strecke zeichnen (z.B. Bemaßung im Plan).'}</div>
    </div>
    ${isPdf ? `
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="ob-scale-50"  class="ob-scale-btn" style="flex:1;">1:50</button>
        <button id="ob-scale-75"  class="ob-scale-btn" style="flex:1;">1:75</button>
        <button id="ob-scale-100" class="ob-scale-btn" style="flex:1;">1:100</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <input type="number" id="ob-scale-free" placeholder="frei: X für 1:X" min="1"
               style="flex:2;padding:9px;border:1px solid #d1d5db;border-radius:10px;" />
        <button id="ob-scale-apply" style="flex:1;">OK</button>
      </div>
      <div style="font-size:11px;color:#8e8e93;margin-bottom:12px;">Hinweis: Exposé-PDFs sind oft
        skaliert gedruckt — Referenzlinie über eine Bemaßungskette ist die sichere Kontrolle.</div>` : ''}
    <button id="ob-draw-ref" style="width:100%;padding:13px;border:none;border-radius:12px;
      background:#8B3DFF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">
      Referenzlinie zeichnen →</button>
    <div style="text-align:center;margin-top:6px;">
      <button id="ob-skip" style="background:none;border:none;color:#8e8e93;font-size:12px;
        cursor:pointer;padding:4px;">Ohne Maßstab (Pixel)</button></div>`;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  // Button-Grundstil
  card.querySelectorAll('.ob-scale-btn, #ob-scale-apply').forEach(b => b.style.cssText +=
    ';padding:10px;border:1.5px solid rgba(0,0,0,0.15);border-radius:10px;background:transparent;cursor:pointer;font-weight:600;');

  const close = () => overlay.remove();
  const applyPrintScale = x => {
    if (!(x >= 1) || !state.pdfPage) return;
    state.scale = scaleFromPrintScale(x, state.pdfPage.widthPt, state.pdfPage.renderedWidthPx)
                  * state.imgDisplayScale / state.imgDisplayScale; // scale ist in Original-px/m
    state.printScale = x;
    state.scaleSource = 'pdf';
    updateRefStatus(); close(); setTool('select');
  };
  if (isPdf) {
    [50, 75, 100].forEach(x =>
      card.querySelector(`#ob-scale-${x}`).onclick = () => applyPrintScale(x));
    card.querySelector('#ob-scale-apply').onclick = () =>
      applyPrintScale(parseFloat(card.querySelector('#ob-scale-free').value));
  }
  card.querySelector('#ob-draw-ref').onclick = () => { close(); setTool('ref'); };
  card.querySelector('#ob-skip').onclick = () => { close(); setTool('select'); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}
```

*Anmerkung Original-px:* `renderedWidthPx` **ist** die Original-Bildbreite (das gerenderte PDF wird wie ein Bild geladen), daher ist `scaleFromPrintScale` bereits in Original-px/m — die scheinbare Multiplikation/Division oben entfällt, Zeile schlicht: `state.scale = scaleFromPrintScale(x, state.pdfPage.widthPt, state.pdfPage.renderedWidthPx);`

- [ ] **Step 4: In `main.js` aufrufen** — an der Stelle, wo bisher `showRefOnboarding(...)` stand (Task 2 hat den Aufruf entfernt): nach erfolgreichem Bild- **und** PDF-Load `showScaleOnboarding();` aufrufen (Import ergänzen).

- [ ] **Step 5: Tests** — `CI=1 npx playwright test calibration pdf-import smoke` → PASS. **Achtung:** `smoke.spec.js` entfernt das Overlay bereits generisch über die ID — bleibt grün.

- [ ] **Step 6: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): Kalibrierungs-Onboarding (PDF 1:X + Referenzlinie)"
```

---

### Task 9: Bericht-Export `io/report.js` (PDF + CSV)

**Files:**
- Create: `wohnflaeche/src/io/report.js`
- Modify: `wohnflaeche/index.html` (2 Buttons), `wohnflaeche/src/main.js` (Verdrahtung)
- Test: `wohnflaeche/tests/report.spec.js`

**Interfaces:**
- Consumes: `totals`, `fmt2` (Task 3); `canvas`; `window.jspdf`
- Produces: `exportReportPDF()`, `exportCSV()`, `buildCSV(rooms, scale): string` (pure, testbar)

- [ ] **Step 1: Failing Test** — `wohnflaeche/tests/report.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { setupApp } from './smoke.spec.js';

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
```

- [ ] **Step 2: Fehlschlag verifizieren** — `CI=1 npx playwright test report` → FAIL.

- [ ] **Step 3: `io/report.js` implementieren:**

```js
import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { totals, fmt2 } from '../woflv/calc.js';

export function buildCSV(rooms, scale) {
  const t = totals(rooms, scale);
  const esc = c => `"${String(c ?? '').replace(/"/g, '""')}"`;
  const rows = [['Raum', 'Art', 'Kategorie', 'Rohfläche m²', 'Abzüge m²',
                 'Zone 50% m²', 'Zone 0% m²', 'Faktor', 'Anrechenbar m²']];
  for (const { room, calc } of t.perRoom)
    rows.push([room.name, room.kind, room.category, fmt2(calc.roh), fmt2(calc.abzugSum),
               fmt2(calc.zone50), fmt2(calc.zone0),
               room.kind === 'zubehoer' ? '—' : String(calc.faktor).replace('.', ','),
               fmt2(calc.anrechenbar)]);
  rows.push([]);
  rows.push(['Wohnfläche gesamt', '', '', '', '', '', '', '', fmt2(t.wohnflaeche)]);
  rows.push(['Nutzfläche (nachrichtlich)', '', '', '', '', '', '', '', fmt2(t.nutzflaeche)]);
  return rows.map(r => r.map(esc).join(';')).join('\r\n');
}

export function exportCSV() {
  const blob = new Blob(['﻿' + buildCSV(state.rooms, state.scale)],
    { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wohnflaeche.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportReportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // ── Seite 1: Plan ──
  const png = canvas.toDataURL({ format: 'png', multiplier: 2 });
  const iw = canvas.width, ih = canvas.height;
  const maxW = 277, maxH = 180;
  const f = Math.min(maxW / iw, maxH / ih);
  doc.setFontSize(14); doc.text('Wohnflächenberechnung — Plan', 10, 12);
  doc.addImage(png, 'PNG', 10, 18, iw * f, ih * f);
  // ── Seite 2: Tabelle ──
  doc.addPage('a4', 'portrait');
  const t = totals(state.rooms, state.scale);
  doc.setFontSize(14); doc.text('Wohnflächenberechnung — Raumliste', 14, 16);
  doc.setFontSize(9);
  const cols = [14, 64, 94, 118, 140, 158, 176];
  const head = ['Raum', 'Kategorie', 'Rohfl. m²', 'Abzüge', 'Zonen 50/0', 'Faktor', 'Anrechenbar'];
  let y = 26;
  doc.setFont(undefined, 'bold');
  head.forEach((h, i) => doc.text(h, cols[i], y));
  doc.setFont(undefined, 'normal');
  y += 3; doc.line(14, y, 196, y); y += 5;
  for (const { room, calc } of t.perRoom) {
    doc.text(String(room.name).slice(0, 28) + (room.kind === 'zubehoer' ? ' (Zubehör)' : ''), cols[0], y);
    doc.text(room.category, cols[1], y);
    doc.text(fmt2(calc.roh), cols[2], y, { align: 'left' });
    doc.text(fmt2(calc.abzugSum), cols[3], y);
    doc.text(`${fmt2(calc.zone50)}/${fmt2(calc.zone0)}`, cols[4], y);
    doc.text(room.kind === 'zubehoer' ? '—' : String(calc.faktor).replace('.', ','), cols[5], y);
    doc.text(fmt2(calc.anrechenbar), cols[6], y);
    y += 6;
    if (y > 270) { doc.addPage('a4', 'portrait'); y = 20; }
  }
  y += 2; doc.line(14, y, 196, y); y += 6;
  doc.setFont(undefined, 'bold');
  doc.text('Wohnfläche gesamt', cols[0], y); doc.text(fmt2(t.wohnflaeche) + ' m²', cols[6], y); y += 6;
  doc.setFont(undefined, 'normal');
  doc.text('Nutzfläche (nachrichtlich)', cols[0], y); doc.text(fmt2(t.nutzflaeche) + ' m²', cols[6], y);
  y += 12;
  doc.setFontSize(7.5); doc.setTextColor(120);
  const quelle = state.scaleSource === 'pdf'
    ? `Maßstab 1:${state.printScale} (aus PDF-Seitengröße)` : 'Maßstab aus Referenzlinie(n)';
  doc.text(`Berechnung in Anlehnung an die Wohnflächenverordnung (WoFlV). Angaben ohne Gewähr.`, 14, y);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} · ${quelle}`, 14, y + 4);
  doc.save('wohnflaechenbericht.pdf');
}

window.exportReportPDF = exportReportPDF;
window.exportCSV = exportCSV;
```

- [ ] **Step 4: Buttons in `index.html`** — neben `btn-save-pdf` (gleicher Button-Stil):

```html
<button id="btn-report-pdf" title="Wohnflächen-Bericht als PDF">Bericht (PDF)</button>
<button id="btn-report-csv" title="Raumliste als CSV">CSV</button>
```

In `main.js`: `import { exportReportPDF, exportCSV } from './io/report.js';` und `document.getElementById('btn-report-pdf').onclick = exportReportPDF; document.getElementById('btn-report-csv').onclick = exportCSV;`

- [ ] **Step 5: Tests** — `CI=1 npx playwright test report` → 2/2 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): PDF-Bericht und CSV-Export"
```

---

### Task 10: Projekt-Speichern/Laden mit Räumen

**Files:**
- Modify: `wohnflaeche/src/io/save-load.js`
- Test: `wohnflaeche/tests/save-load.spec.js`

**Interfaces:**
- Consumes: `rebuildRooms`, `syncRoomIdCounter` (Task 4), `updateRoomList` (Task 5)
- Produces: Projekt-JSON-Format v2 (`version: 2`, Feld `rooms`, `printScale`, `pdfPage`)

- [ ] **Step 1: Failing Test** — `wohnflaeche/tests/save-load.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { setupApp } from './smoke.spec.js';

test('Räume überleben Speichern → Laden (Round-Trip)', async ({ page }) => {
  await setupApp(page);
  const json = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { rebuildRooms, syncRoomIdCounter } = await import('/src/tools/room.js');
    const sl = await import('/src/io/save-load.js');
    const s = state.scale;
    state.rooms = [{ id: 1, name: 'Küche', kind: 'wohnflaeche', category: 'normal',
      balkonFaktor: 0.25,
      polygon: [{x:100,y:100},{x:100+3*s,y:100},{x:100+3*s,y:100+2*s},{x:100,y:100+2*s}],
      zones: [{ id: 1, polygon: [{x:110,y:110},{x:160,y:110},{x:160,y:160},{x:110,y:160}], height: '1bis2m' }],
      deductions: [] }];
    syncRoomIdCounter(); rebuildRooms();
    return sl.buildProjectJSON();   // Task-10-Export (Name ggf. an save-load.js anpassen)
  });
  const restored = await page.evaluate(async (j) => {
    const { state } = await import('/src/state.js');
    const sl = await import('/src/io/save-load.js');
    state.rooms = [];
    await sl.loadProjectJSON(j);
    return { n: state.rooms.length, name: state.rooms[0]?.name,
             zones: state.rooms[0]?.zones.length, version: JSON.parse(j).version };
  }, json);
  expect(restored.version).toBe(2);
  expect(restored.n).toBe(1);
  expect(restored.name).toBe('Küche');
  expect(restored.zones).toBe(1);
});
```

- [ ] **Step 2: Fehlschlag verifizieren** — `CI=1 npx playwright test save-load` → FAIL.

- [ ] **Step 3: `save-load.js` anpassen** — per `grep -n "JSON.stringify\|JSON.parse\|export function" src/io/save-load.js` die Serialisierungs- und Lade-Funktion finden:
  1. Die Funktionen, die das Projekt-Objekt bauen/lesen, als `buildProjectJSON()` / `loadProjectJSON(jsonString)` exportieren (falls sie bereits exportiert sind, nur intern erweitern und die Test-Namen an die realen anpassen — dann den Testcode entsprechend ändern und im Commit dokumentieren).
  2. Beim Speichern ergänzen: `version: 2, rooms: state.rooms, printScale: state.printScale, pdfPage: state.pdfPage`.
  3. Beim Laden: `state.rooms = data.rooms || []; state.printScale = data.printScale ?? null; state.pdfPage = data.pdfPage ?? null;` danach `syncRoomIdCounter(); rebuildRooms(); window.updateRoomList?.();` (Imports ergänzen).
  4. Raumnamen werden beim Rendern bereits escaped (raumliste.js) — kein zusätzliches Escaping beim Laden nötig; der XSS-Test aus Task 5 deckt das ab.

- [ ] **Step 4: Tests** — `CI=1 npx playwright test save-load raumliste` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A wohnflaeche && git commit -m "feat(wohnflaeche): Projekt-JSON v2 mit Räumen (Round-Trip getestet)"
```

---

### Task 11: Auslieferung — `wohnflaeche.html` im Root + README

**Files:**
- Create: `wohnflaeche.html` (Build-Artefakt, Repo-Root)
- Modify: `README.md` (Tabelle + Test-Anleitung)

- [ ] **Step 1: Voller Testlauf + Build**

```bash
cd wohnflaeche
CI=1 npx playwright test
npm run build
cp dist/index.html ../wohnflaeche.html
```
Expected: alle Tests PASS; `wohnflaeche.html` existiert im Root (> 200 KB).

- [ ] **Step 2: Root-Datei im Browser gegenprüfen** — `wohnflaeche.html` per Playwright wie in planers Muster laden (file://-Smoke: Seite lädt ohne `pageerror`/Console-Error; manuell: Bild laden, Raum zeichnen).

- [ ] **Step 3: README ergänzen** — in der Repo-Layout-Tabelle:

```markdown
| `wohnflaeche.html` | Wohnflächen-App: Messen in Wohnungsgrundrissen, WoFlV-Berechnung (Single-File-Build). |
| `wohnflaeche/` | Quellcode der Wohnflächen-App (Vite + ES-Module). |
```

Unter „Tests“ ergänzen:

```markdown
Wohnflächen-App:
```bash
cd wohnflaeche
npm test
```
```

- [ ] **Step 4: Commit**

```bash
git add wohnflaeche.html README.md wohnflaeche
git commit -m "feat(wohnflaeche): Single-File-Build im Root + README"
```

- [ ] **Step 5: Abschluss** — `superpowers:finishing-a-development-branch` verwenden (Merge-/PR-Entscheidung beim Nutzer).

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Copy&Strip (T1–2) ✓ · Datenmodell + WoFlV-Rechnung inkl. aller Faktoren/Validierungen (T3) ✓ · Raum-Werkzeug mit 90°-Snap + Kategorien-Modal (T4) ✓ · Raumliste + Summen + XSS (T5) ✓ · Zonen/Abzüge inkl. Clipping + 0,1-m²-Regel (T6) ✓ · PDF-Import mit SRI + Seitenwahl (T7) ✓ · Kalibrierung PDF-1:X + Referenzlinie + Gating (T8) ✓ · PDF-Bericht + CSV de-DE (T9) ✓ · JSON v2 Round-Trip (T10) ✓ · Root-Deploy + README (T11) ✓. Fehlerbehandlung: defektes PDF → Toast (T7), selbstüberschneidende Polygone → Shoelace-Betrag (Kern von T3), `_safeHandler` bleibt aus Kopie erhalten.
- **Bewusste Offenheit:** In T2 (Strip), T7/T10 (Einstiegsfunktionen von image-loader/save-load) verweist der Plan auf grep-Kommandos statt erfundener Zeilennummern/Signaturen — die exakten Namen stehen erst beim Lesen der kopierten Dateien fest. Der Implementierer passt dann Testnamen an die realen Exporte an (in T10 explizit erlaubt).
- **Typkonsistenz:** `rebuildRooms/syncRoomIdCounter` (T4) ↔ Nutzung in T5/T6/T10 ✓ · `roomCalc`-Rückgabefelder (T3) ↔ raumliste/report ✓ · `state.pdfPage {widthPt,heightPt,renderedWidthPx}` (T7) ↔ T8-Test ✓ · Overlay-ID `onboarding-overlay` konsistent mit setupApp ✓.

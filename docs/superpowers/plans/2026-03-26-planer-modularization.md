# Planer App Modularization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `index-1.html` (~8700 lines) into ~30 ES modules with Vite, producing an identical single-file HTML output.

**Architecture:** Vite + vite-plugin-singlefile bundles ES modules back into one HTML file. CDN libraries stay as `<script>` tags. Migration is incremental — after every task, `npm run build` produces a working app.

**Tech Stack:** Vite 6, vite-plugin-singlefile, ES modules, Fabric.js 5.3.1

**Spec:** `docs/superpowers/specs/2026-03-26-planer-modularization-design.md`

---

## Files

| File | Action | Responsibility |
|------|--------|---------------|
| `index-1.html` | **READ-ONLY REFERENCE** | Original monolith — do not modify, keep as backup |
| `planer/index.html` | **CREATE** | HTML skeleton + inline CSS + CDN script tags |
| `planer/package.json` | **CREATE** | Vite dev dependencies |
| `planer/vite.config.js` | **CREATE** | Vite config with singlefile plugin |
| `planer/src/main.js` | **CREATE** | Entry point: initially all JS, shrinks as modules are extracted |
| `planer/src/state.js` | **CREATE** | state, PIPE_TYPES, measureId, CANVAS_SERIAL_PROPS |
| `planer/src/canvas.js` | **CREATE** | Fabric canvas instance, _safeHandler, pan/zoom |
| `planer/src/undo.js` | **CREATE** | History, snapshot, undo/redo, restore hook registry |
| `planer/src/tools/tool-manager.js` | **CREATE** | setTool, requireScale, TOOL_NAMES, TOOL_HINTS |
| `planer/src/tools/ref.js` | **CREATE** | Scale calibration tool |
| `planer/src/tools/distance.js` | **CREATE** | Distance measurement |
| `planer/src/tools/area.js` | **CREATE** | Area measurement |
| `planer/src/tools/circle.js` | **CREATE** | Circle tool |
| `planer/src/tools/arc.js` | **CREATE** | Arc/sector tool |
| `planer/src/tools/pipe.js` | **CREATE** | Pipe drawing + editing |
| `planer/src/tools/pipe-refs.js` | **CREATE** | Hilfslinien/Hilfspunkte |
| `planer/src/tools/label.js` | **CREATE** | Label tool + live label |
| `planer/src/tools/select.js` | **CREATE** | Selection routing |
| `planer/src/ui/sidebar.js` | **CREATE** | Accordion, resize, measurement list, pipe panel |
| `planer/src/ui/modals.js` | **CREATE** | createModal, showToast |
| `planer/src/ui/statusbar.js` | **CREATE** | Status bar, _notifyBadge |
| `planer/src/ui/grid.js` | **CREATE** | Grid overlay |
| `planer/src/ui/pipe-legend.js` | **CREATE** | Pipe legend display |
| `planer/src/ui/pipe-guides.js` | **CREATE** | Dim-line compute + render |
| `planer/src/ui/pipe-assign.js` | **CREATE** | Assign mode |
| `planer/src/ui/materialrechner.js` | **CREATE** | Materials calculator |
| `planer/src/ui/whats-new.js` | **CREATE** | Release notes, bug report |
| `planer/src/mobile/touch.js` | **CREATE** | Touch capture, magnifier, finish button |
| `planer/src/mobile/drawer.js` | **CREATE** | Mobile drawer, bottom toolbar |
| `planer/src/io/image-loader.js` | **CREATE** | Image/PDF loading |
| `planer/src/io/photogrammetry.js` | **CREATE** | EXIF, sensor DB, accuracy |
| `planer/src/io/save-load.js` | **CREATE** | Project save/load |
| `planer/src/io/export.js` | **CREATE** | PDF/PNG export |
| `planer/src/io/pipe-transfer.js` | **CREATE** | Pipe export/import with anchor alignment |
| `planer/src/io/library.js` | **CREATE** | Built-in + custom library |
| `planer/src/onboarding/welcome.js` | **CREATE** | Welcome onboarding |
| `planer/src/onboarding/ref-onboarding.js` | **CREATE** | Ref tool onboarding |
| `planer/src/utils/loupe.js` | **CREATE** | Desktop magnifier |
| `planer/src/utils/helpers.js` | **CREATE** | Geometry, formatting, small utilities |

---

## Verification Protocol

After EVERY task:

```bash
cd planer && npm run build
```

Then open `planer/dist/index.html` in browser and verify:
1. Page loads without console errors
2. Image upload works
3. Drawing tools work (at minimum: select, distance)
4. Undo/redo works

For mobile-related tasks, also test on mobile or with Chrome DevTools device mode.

### Inline `onclick` handlers

The monolith uses `onclick="functionName(...)"` in dynamically generated HTML. When extracting a module that generates such HTML, the module must explicitly expose those functions on `window`:

```js
window.removeMeasurement = removeMeasurement;
window.toggleAcc = toggleAcc;
```

This applies to: `sidebar.js`, `save-load.js`, `pipe-legend.js`, `whats-new.js`, `materialrechner.js`, and any other module that builds HTML strings with inline handlers. Check the monolith source for `onclick=` patterns in each module's code range.

---

## Task 1: Vite Project Scaffold

**Files:**
- Create: `planer/package.json`
- Create: `planer/vite.config.js`
- Create: `planer/index.html`
- Create: `planer/src/main.js`

This task sets up the build system and moves the monolith into the Vite project structure. After this task, `npm run build` produces a working single-file app identical to `index-1.html`.

- [ ] **Step 1: Create `planer/` directory and `package.json`**

```json
{
  "name": "planer",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd planer && npm install --save-dev vite vite-plugin-singlefile
```

- [ ] **Step 3: Create `planer/vite.config.js`**

```js
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: Infinity,
  },
});
```

**CDN globals note:** Fabric.js, jsPDF, PDF.js, and exifr are loaded via `<script>` tags in the HTML and accessed as `window.fabric`, `window.jspdf`, `window.pdfjsLib`, `window.exifr` throughout the code. Since they are never `import`-ed as ES modules, Vite will not try to resolve or bundle them — no `rollupOptions.external` config is needed.

- [ ] **Step 4: Extract HTML + CSS from `index-1.html` into `planer/index.html`**

Copy lines 1-1907 from `index-1.html` (everything up to and including `<script>`). Change the opening `<script>` tag to:

```html
<script type="module" src="/src/main.js"></script>
```

Remove the closing `</script>` tag from the end of the copied HTML (it will be in main.js now).

The CDN `<script>` tags (Fabric.js, jsPDF, exifr, PDF.js) stay in the HTML `<head>` as-is.

- [ ] **Step 5: Extract all JavaScript into `planer/src/main.js`**

Copy lines 1912-8722 from `index-1.html` (everything between the `<script>` tags) into `planer/src/main.js`. This is the entire JS codebase as-is — no modifications yet.

- [ ] **Step 6: Build and verify**

```bash
cd planer && npm run build
```

Open `planer/dist/index.html` in browser. Verify the app loads and works identically to `index-1.html`.

- [ ] **Step 7: Commit**

```bash
git add planer/
git commit -m "feat: scaffold Vite project with monolith as single main.js"
```

---

## Task 2: Extract `state.js`

**Files:**
- Create: `planer/src/state.js`
- Modify: `planer/src/main.js`

Extract the central state object, PIPE_TYPES, measureId counter, and related constants. These are the foundation that every other module will import.

**Source lines in main.js (originally index-1.html):**
- PIPE_TYPES: lines 1912-1934
- state + measureId: lines 1938-2006
- CANVAS_SERIAL_PROPS: inside undo section ~line 2377 (the `const CANVAS_SERIAL_PROPS = [...]` array)
- _isTouchDevice + TOUCH_SCALE: lines 8149-8151

- [ ] **Step 1: Create `planer/src/state.js`**

Move the following from `main.js` into `state.js`:
- `const PIPE_TYPES = { ... };`
- `const state = { ... };`
- `let measureId = 0;`
- `const CANVAS_SERIAL_PROPS = [...]` (find this array near the undo section)
- `const _isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;`
- `const TOUCH_SCALE = _isTouchDevice ? 1.5 : 1.0;`

Export all of them:

```js
export const PIPE_TYPES = { ... };
export const state = { ... };
export let measureId = 0;
export function nextMeasureId() { return ++measureId; }
export function setMeasureId(val) { measureId = val; }
export const CANVAS_SERIAL_PROPS = [...];
export const _isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
export const TOUCH_SCALE = _isTouchDevice ? 1.5 : 1.0;
```

Note: `measureId` is a `let` that gets incremented with `++measureId` throughout the code. Since ES modules export live bindings for `let`, direct mutation from other modules works. But for clarity, export `nextMeasureId()` and `setMeasureId()` helper functions.

- [ ] **Step 2: Update `main.js`**

At the top of `main.js`, add:

```js
import { PIPE_TYPES, state, measureId, nextMeasureId, setMeasureId, CANVAS_SERIAL_PROPS, _isTouchDevice, TOUCH_SCALE } from './state.js';
```

Remove the moved code blocks from `main.js`. Replace all `++measureId` with `nextMeasureId()` and bare reads of `measureId` with the import (live binding works for reads).

- [ ] **Step 3: Build and verify**

```bash
cd planer && npm run build
```

Open `planer/dist/index.html` — verify app works.

- [ ] **Step 4: Commit**

```bash
git add planer/src/state.js planer/src/main.js
git commit -m "refactor: extract state.js (state, PIPE_TYPES, measureId)"
```

---

## Task 3: Extract `canvas.js`

**Files:**
- Create: `planer/src/canvas.js`
- Modify: `planer/src/main.js`

Extract the Fabric.js canvas instance, the `_safeHandler` wrapper, and pan/zoom functions.

**Source lines:**
- Canvas creation: lines 2025-2032
- _safeHandler: line ~3706 (in CANVAS EVENTS section header)
- Panning & Zoom: lines 4002-4091 (showZoomHUD, setZoom, zoomToFit, startPan, stopPan)

- [ ] **Step 1: Create `planer/src/canvas.js`**

```js
import { state } from './state.js';

const wrapper = document.getElementById('canvas-wrapper');
const canvas = new fabric.Canvas('c', {
  // ... copy exact options from monolith
});

export { canvas, wrapper };

export function _safeHandler(fn) {
  return function(opt) {
    try { fn.call(this, opt); }
    catch (e) { console.error('Canvas-Event-Handler Fehler:', e); }
  };
}

// Pan & Zoom functions — copy from monolith lines 4002-4091
let _zoomHudTimer = null;
// ... showZoomHUD, setZoom, zoomToFit, startPan, stopPan
export { showZoomHUD, setZoom, zoomToFit, startPan, stopPan };
```

- [ ] **Step 2: Update `main.js`**

```js
import { canvas, wrapper, _safeHandler, showZoomHUD, setZoom, zoomToFit, startPan, stopPan } from './canvas.js';
```

Remove the moved code from `main.js`.

- [ ] **Step 3: Build and verify**

```bash
cd planer && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add planer/src/canvas.js planer/src/main.js
git commit -m "refactor: extract canvas.js (canvas instance, pan/zoom)"
```

---

## Task 4: Extract `undo.js`

**Files:**
- Create: `planer/src/undo.js`
- Modify: `planer/src/main.js`

Extract the undo/redo system with a hook registry to avoid circular dependencies.

**Source lines:** 2377-2482

- [ ] **Step 1: Create `planer/src/undo.js`**

```js
import { state, CANVAS_SERIAL_PROPS, setMeasureId } from './state.js';
import { canvas } from './canvas.js';

export const history = { past: [], future: [], MAX: 40, _paused: false, _restoring: false };

const _restoreHooks = [];
export function registerRestoreHook(fn) { _restoreHooks.push(fn); }

export function getSnapshot() { /* ... copy from monolith */ }
export function saveSnapshot() { /* ... copy from monolith */ }

export function restoreSnapshot(snap) {
  history._paused = true;
  history._restoring = true;
  const bg = state.backgroundImage;
  try {
    canvas.loadFromJSON(JSON.parse(snap.canvas), () => {
      try {
        // ... restore state (copy from monolith)
        // Call all registered restore hooks instead of direct function calls
        _restoreHooks.forEach(fn => fn());
        canvas.renderAll();
        canvas.getObjects().filter(o => o._dimLinePipeId != null).forEach(o => canvas.remove(o));
        // renderAllDimLines is called via hook
      } catch (e) {
        console.error('Fehler beim Wiederherstellen des Snapshots:', e);
      } finally {
        history._paused = false;
        history._restoring = false;
        updateUndoRedoButtons();
      }
    });
  } catch (e) {
    console.error('Fehler beim Laden des Canvas-JSON:', e);
    history._paused = false;
    history._restoring = false;
    updateUndoRedoButtons();
  }
}

export function undo() { /* ... copy from monolith */ }
export function redo() { /* ... copy from monolith */ }
export function updateUndoRedoButtons() { /* ... copy from monolith */ }
```

- [ ] **Step 2: Update `main.js`**

Import from `undo.js`, remove the moved code. Wherever other sections call `saveSnapshot()`, they will later import from `undo.js` directly — for now, the functions are still accessible because `main.js` imports and re-exports them implicitly (they're in module scope).

- [ ] **Step 3: Build and verify**

```bash
cd planer && npm run build
```

Test undo/redo specifically: draw something → undo → redo.

- [ ] **Step 4: Commit**

```bash
git add planer/src/undo.js planer/src/main.js
git commit -m "refactor: extract undo.js with restore hook registry"
```

---

## Task 5: Extract `utils/helpers.js` and `ui/modals.js`

**Files:**
- Create: `planer/src/utils/helpers.js`
- Create: `planer/src/ui/modals.js`
- Modify: `planer/src/main.js`

Extract pure utility functions and the modal system — these have no complex dependencies and are used by many other modules.

**Source lines:**
- MODAL: lines 6923-6947 (createModal)
- showToast, showMeasurementToast: in TOOL MANAGEMENT section ~lines 2540-2580
- HELPERS: lines 6285-6408 (addLabel, addEndpointDot, formatDistance, formatArea, etc.)
- CANCEL DRAWING: lines 6412-6436
- LIVE LABEL: lines 6248-6281
- Geometry functions: scattered in PIPE DISTANCE GUIDES section (pointToSegmentDist, projectPointOnLine, closestPointOnSegment)

- [ ] **Step 1: Create `planer/src/ui/modals.js`**

Move `createModal()`, `showToast()`, `showMeasurementToast()` here. These are pure UI utilities with no state dependency.

```js
export function createModal(title, body, onOk) { /* ... */ }
export function showToast(msg, type) { /* ... */ }
export function showMeasurementToast(label, value) { /* ... */ }
```

- [ ] **Step 2: Create `planer/src/utils/helpers.js`**

Move all pure/small utility functions here:

```js
import { canvas } from '../canvas.js';
import { state } from '../state.js';

// Geometry
export function pointToSegmentDist(p, a, b) { /* ... */ }
export function projectPointOnLine(p, a, b) { /* ... */ }
export function closestPointOnSegment(p, a, b) { /* ... */ }
export function ptDist(a, b) { /* ... */ }
export function polygonArea(pts) { /* ... */ }

// Formatting
export function formatDistance(m) { /* ... */ }
export function formatArea(m2) { /* ... */ }
export function formatErr(m) { /* ... */ }
export function distErr_m(m) { /* ... */ }
export function areaRelErr_pct(m2) { /* ... */ }

// Canvas helpers
export function addLabel(x, y, text, opts) { /* ... */ }
export function addEndpointDot(x, y, color, measureId) { /* ... */ }
export function addRefEndmarks(x1, y1, x2, y2, color) { /* ... */ }
export function addTickMarks(pts) { /* ... */ }
export function snapToPixel(p) { /* ... */ }
export function cancelDrawing() { /* ... */ }

```

Note: `updateLiveLabel` and `removeLiveLabel` belong in `tools/label.js` (extracted in Task 8), not here.

- [ ] **Step 3: Update `main.js`**

Add imports, remove moved code.

- [ ] **Step 4: Build and verify**

```bash
cd planer && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add planer/src/utils/ planer/src/ui/modals.js planer/src/main.js
git commit -m "refactor: extract helpers.js and modals.js"
```

---

## Task 6: Extract `ui/grid.js`, `ui/materialrechner.js`, `utils/loupe.js`

**Files:**
- Create: `planer/src/ui/grid.js`
- Create: `planer/src/ui/materialrechner.js`
- Create: `planer/src/utils/loupe.js`
- Modify: `planer/src/main.js`

Three self-contained modules with minimal dependencies.

**Source lines:**
- GRID OVERLAY: 5686-5851
- MATERIALRECHNER: 6488-6919
- LOUPE: 3602-3699

- [ ] **Step 1: Create the three modules**

Each module imports only what it needs from `state.js` and `canvas.js`. The loupe IIFE becomes a module with named exports (`show`, `hide`, `update`).

- [ ] **Step 2: Update `main.js`**, remove moved code, add imports

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

```bash
git add planer/src/ui/grid.js planer/src/ui/materialrechner.js planer/src/utils/loupe.js planer/src/main.js
git commit -m "refactor: extract grid, materialrechner, loupe modules"
```

---

## Task 7: Extract `ui/statusbar.js`, `ui/whats-new.js`, `onboarding/*.js`

**Files:**
- Create: `planer/src/ui/statusbar.js`
- Create: `planer/src/ui/whats-new.js`
- Create: `planer/src/onboarding/welcome.js`
- Create: `planer/src/onboarding/ref-onboarding.js`
- Modify: `planer/src/main.js`

**Source lines:**
- NOTIFICATION BADGES: 2010-2021 → `statusbar.js`
- RELEASE NOTES & BUG REPORT: 8005-8105 → `whats-new.js`
- SCHRIFTGRÖSSEN-CLUSTER: 7952-8001 → `sidebar.js` (extracted later in Task 12, leave in main.js for now)
- WELCOME ONBOARDING: 3056-3255 → `welcome.js`
- ONBOARDING: 3259-3453 → `ref-onboarding.js`

- [ ] **Step 1: Create the four modules** with appropriate imports/exports

- [ ] **Step 2: Update `main.js`**

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

```bash
git add planer/src/ui/statusbar.js planer/src/ui/whats-new.js planer/src/onboarding/ planer/src/main.js
git commit -m "refactor: extract statusbar, whats-new, onboarding modules"
```

---

## Task 8: Extract `tools/tool-manager.js` and simple tools

**Files:**
- Create: `planer/src/tools/tool-manager.js`
- Create: `planer/src/tools/distance.js`
- Create: `planer/src/tools/area.js`
- Create: `planer/src/tools/circle.js`
- Create: `planer/src/tools/arc.js`
- Create: `planer/src/tools/label.js`
- Modify: `planer/src/main.js`

**Source lines:**
- TOOL MANAGEMENT: 2486-2702 → `tool-manager.js`
- COLOR PICKER: 2706-2713, FONT SIZE: 2717-2721, LABEL BG: 2725-2732 → `tool-manager.js`
- DISTANCE TOOL: 4413-4471 → `distance.js`
- AREA TOOL: 4475-4527 → `area.js`
- CIRCLE TOOL: 5966-6048 → `circle.js`
- ARC TOOL: 6052-6209 → `arc.js`
- LABEL TOOL: 6213-6244 → `label.js`

- [ ] **Step 1: Create `tools/tool-manager.js`**

Export: `setTool`, `requireScale`, `TOOL_NAMES`, `TOOL_HINTS`, `updateMeasureButtons`. Include color picker, font size, and label background toggle event setup as an `initToolbar()` function.

- [ ] **Step 2: Create the five simple tool modules**

Each exports its handler functions. Example for `distance.js`:

```js
import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { addLabel, addEndpointDot, formatDistance, snapToPixel } from '../utils/helpers.js';

export function handleDistanceClick(p) { /* ... */ }
export function finishDistance() { /* ... */ }
```

- [ ] **Step 3: Update `main.js`** — import tools, update the `switch (state.tool)` routing in `mouse:down`

- [ ] **Step 4: Build and verify** — test each tool

- [ ] **Step 5: Commit**

```bash
git add planer/src/tools/ planer/src/main.js
git commit -m "refactor: extract tool-manager and simple tool modules"
```

---

## Task 9: Extract `tools/ref.js` and `io/photogrammetry.js`

**Files:**
- Create: `planer/src/tools/ref.js`
- Create: `planer/src/io/photogrammetry.js`
- Modify: `planer/src/main.js`

**Source lines:**
- REFERENCE TOOL: 4139-4409 → `ref.js`
- EXIF / PHOTOGRAMMETRIE: 2736-3052 → `photogrammetry.js`

These are coupled: `ref.js` calls `updateRefStatus()` which uses accuracy calculations from `photogrammetry.js`.

- [ ] **Step 1: Create `io/photogrammetry.js`**

Export: `SENSOR_DB`, `lookupSensor`, `calcGSD`, `calcAccuracy`, `calcRequiredForTarget`, `calcFlightRecommendation`, `flightRecommendationTableHTML`, `showAccuracyDetail`, `hideAccuracyDetail`.

- [ ] **Step 2: Create `tools/ref.js`**

Export: `handleRefClick`, `promptReference`, `updateRefStatus`, `showAccuracyDetail` (delegates to photogrammetry).

- [ ] **Step 3: Update `main.js`**, register `updateRefStatus` as a restore hook:

```js
import { registerRestoreHook } from './undo.js';
import { updateRefStatus } from './tools/ref.js';
registerRestoreHook(updateRefStatus);
```

- [ ] **Step 4: Build and verify** — test scale calibration with reference tool

- [ ] **Step 5: Commit**

```bash
git add planer/src/tools/ref.js planer/src/io/photogrammetry.js planer/src/main.js
git commit -m "refactor: extract ref tool and photogrammetry module"
```

---

## Task 10: Extract `tools/pipe-refs.js`, `tools/pipe.js`, `tools/select.js`

**Files:**
- Create: `planer/src/tools/pipe-refs.js`
- Create: `planer/src/tools/pipe.js`
- Create: `planer/src/tools/select.js`
- Modify: `planer/src/main.js`

**Source lines:**
- PIPE REFERENCES: 4784-5010 → `pipe-refs.js`
- PIPE TOOL: 4531-4634 → `pipe.js` (drawing)
- PIPE EDITING: 4638-4780 → `pipe.js` (editing, vertex manipulation)
- PIPE LAYER TOGGLE: 5855-5962 → `pipe.js` (togglePipeLayer, sendPipesToBack, offsetOverlappingPipes)
- Selection logic from CANVAS EVENTS → `select.js`

- [ ] **Step 1: Create `tools/pipe-refs.js`**

Export: `handlePipeRefClick`, `promptPipeRefName`, `createPipeRefLine`, `createPipeRefPoint`, `removePipeRef`, `togglePipeRef`, `updatePipeRefList`, `pipeRefId` counter.

- [ ] **Step 2: Create `tools/pipe.js`**

Export: `handlePipeClick`, `updatePreviewPipe`, `finishPipe`, `startPipeEdit`, `endPipeEdit`, `updatePipeFromHandles`, `insertPipeVertex`, `deletePipeVertex`, `togglePipeLayer`, `sendPipesToBack`, `offsetOverlappingPipes`.

- [ ] **Step 3: Create `tools/select.js`**

Extract the selection-related logic from canvas events: pipe edit entry on double-click, label selection, etc.

- [ ] **Step 4: Update `main.js`**, register restore hooks:

```js
import { registerRestoreHook } from './undo.js';
import { updatePipeRefList } from './tools/pipe-refs.js';
registerRestoreHook(updatePipeRefList);
```

- [ ] **Step 5: Build and verify** — test pipe drawing, editing, Hilfslinien

- [ ] **Step 6: Commit**

```bash
git add planer/src/tools/pipe-refs.js planer/src/tools/pipe.js planer/src/tools/select.js planer/src/main.js
git commit -m "refactor: extract pipe, pipe-refs, and select modules"
```

---

## Task 11: Extract `ui/pipe-guides.js`, `ui/pipe-assign.js`, `ui/pipe-legend.js`

**Files:**
- Create: `planer/src/ui/pipe-guides.js`
- Create: `planer/src/ui/pipe-assign.js`
- Create: `planer/src/ui/pipe-legend.js`
- Modify: `planer/src/main.js`

**Source lines:**
- PIPE DISTANCE GUIDES: 5014-5588 → `pipe-guides.js` (dim-line computation/rendering) + `pipe-assign.js` (assign mode)
- PIPE LEGEND: 5592-5682 → `pipe-legend.js`

Split the 575-line PIPE DISTANCE GUIDES section: dim-line rendering goes into `pipe-guides.js`, assign mode (startAssignMode, endAssignMode, toggleRefAssignment, confirmAssignMode, cancelAssignMode) goes into `pipe-assign.js`.

- [ ] **Step 1: Create `ui/pipe-guides.js`**

Export: `clearPipeDistanceGuides`, `showPipeDistanceGuides`, `computeDimLine`, `renderDimLinesForPipe`, `renderAllDimLines`, `clearDimLinesForPipe`.

Register `renderAllDimLines` as a restore hook.

- [ ] **Step 2: Create `ui/pipe-assign.js`**

Export: `startAssignMode`, `endAssignMode`, `confirmAssignMode`, `cancelAssignMode`, `toggleRefAssignment`, `directToggleRef`.

- [ ] **Step 3: Create `ui/pipe-legend.js`**

Export: `updatePipeLegend`.

Register as restore hook.

- [ ] **Step 4: Update `main.js`**, register canvas event handlers for dim-line dragging

- [ ] **Step 5: Build and verify** — test dim-lines, assign mode, legend

- [ ] **Step 6: Commit**

```bash
git add planer/src/ui/pipe-guides.js planer/src/ui/pipe-assign.js planer/src/ui/pipe-legend.js planer/src/main.js
git commit -m "refactor: extract pipe-guides, pipe-assign, pipe-legend modules"
```

---

## Task 12: Extract `ui/sidebar.js`

**Files:**
- Create: `planer/src/ui/sidebar.js`
- Modify: `planer/src/main.js`

**Source lines:**
- MEASUREMENT LIST: 6440-6484
- AKKORDEON SIDEBAR: 7932-7948
- SIDEBAR RESIZE: 7863-7928
- SCHRIFTGRÖSSEN-CLUSTER: 7952-8001 (resizeLabelCluster)
- updatePipePanel from PIPE LAYER TOGGLE section

- [ ] **Step 1: Create `ui/sidebar.js`**

Export: `updateMeasurementList`, `toggleAcc`, `initSidebarResize`, `resizeLabelCluster`, `updatePipePanel`.

Register `updateMeasurementList`, `updatePipePanel` as restore hooks.

Expose `toggleAcc`, `removeMeasurement`, `openMaterialCalc` on `window` for inline onclick handlers in dynamically generated HTML.

- [ ] **Step 2: Update `main.js`**

- [ ] **Step 3: Build and verify** — test accordion, measurement list, sidebar resize

- [ ] **Step 4: Commit**

```bash
git add planer/src/ui/sidebar.js planer/src/main.js
git commit -m "refactor: extract sidebar module"
```

---

## Task 13: Extract IO modules

**Files:**
- Create: `planer/src/io/image-loader.js`
- Create: `planer/src/io/save-load.js`
- Create: `planer/src/io/export.js`
- Create: `planer/src/io/pipe-transfer.js`
- Create: `planer/src/io/library.js`
- Modify: `planer/src/main.js`

**Source lines:**
- IMAGE UPLOAD: 3457-3598 → `image-loader.js`
- SAVE / LOAD: 6951-7312 → `save-load.js`
- LEITUNGEN EXPORTIEREN: 7316-7838 → `pipe-transfer.js` (anchor export/import) + `export.js` (PDF/PNG)
- LIBRARY + CUSTOM LIBRARY: 2036-2077 + 2081-2373 → `library.js`

- [ ] **Step 1: Create `io/image-loader.js`**

Export: `normalizeOrientation`, `loadImageFromDataUrl`, `loadFileAuto`, `loadPdf`. Include drag-and-drop handler setup.

- [ ] **Step 2: Create `io/save-load.js`**

Export: `showSaveLoadDialog`, the JSON save/load handlers. Expose necessary functions on `window` for onclick handlers.

- [ ] **Step 3: Create `io/export.js`**

Export: PDF and PNG export functions.

- [ ] **Step 4: Create `io/pipe-transfer.js`**

Export: `_anchorExport`, `_anchorImport` state, `handleLeitungenAlignClick`, `doExportLeitungen`, `doImportLeitungen`, `_anchorBannerImport`, `_removeBanner`.

- [ ] **Step 5: Create `io/library.js`**

Export: `LIBRARY`, `LIB_CATS`, `customLibItems`, `renderLibrary`, `placeLibraryItem`, `placeCustomLibItem`, `toggleLibLayer`, `initCustomLib`.

- [ ] **Step 6: Update `main.js`**

- [ ] **Step 7: Build and verify** — test image load, save/load, PDF export, library

- [ ] **Step 8: Commit**

```bash
git add planer/src/io/ planer/src/main.js
git commit -m "refactor: extract IO modules (image, save/load, export, pipe-transfer, library)"
```

---

## Task 14: Extract mobile modules

**Files:**
- Create: `planer/src/mobile/touch.js`
- Create: `planer/src/mobile/drawer.js`
- Modify: `planer/src/main.js`

**Source lines:**
- MOBILE: DRAWER TOGGLE: 8109-8145 → `drawer.js`
- MOBILE: BOTTOM TOUCH TOOLBAR: 8171-8290 → `drawer.js`
- TOUCH: STATE-MACHINE: 8297-8316 → `touch.js`
- MOBILE MAGNIFIER: 8320-8396 → `touch.js`
- MOBILE CROSSHAIR: 8400-8408 → `touch.js`
- MOBILE FINISH BUTTON: 8412-8435 → `touch.js`
- MOBILE: PUNKT-JUSTIERUNG: 8441-8704 → `touch.js`
- MOBILE: CANVAS-GRÖßE: 8708-8722 → `drawer.js`
- MOBILE: TOUCH EVENTS: 8149-8167 → `touch.js` (setup, detection already in state.js)

- [ ] **Step 1: Create `mobile/touch.js`**

Export: `_touchState`, `_mobileMag`, `_showMobileCrosshair`, `_hideMobileCrosshair`, `_updateFinishBtn`, `_getCanvasPtrFromTouch`, `initTouchHandlers`.

The `initTouchHandlers()` function registers all capture-phase touch event listeners.

- [ ] **Step 2: Create `mobile/drawer.js`**

Export: `initMobileDrawer`, `initBottomToolbar`. Include orientation change handler.

- [ ] **Step 3: Update `main.js`** — call `initTouchHandlers()` and `initMobileDrawer()` conditionally based on `_isTouchDevice`

- [ ] **Step 4: Build and verify** — test on mobile (or Chrome DevTools device mode): touch drawing, pinch-zoom, drawer, bottom toolbar

- [ ] **Step 5: Commit**

```bash
git add planer/src/mobile/ planer/src/main.js
git commit -m "refactor: extract mobile modules (touch, drawer)"
```

---

## Task 15: Cleanup and final verification

**Files:**
- Modify: `planer/src/main.js`

After all modules are extracted, `main.js` should contain only:
- Import statements
- Canvas event handler registration (~300 lines routing `mouse:down`, `mouse:move`, etc.)
- Keyboard shortcut handler
- Restore hook registrations
- Window resize handler
- Init calls (`initCustomLib`, `initTouchHandlers`, `initMobileDrawer`, `initSidebarResize`, etc.)

- [ ] **Step 1: Audit `main.js`**

Check that no business logic remains — only imports, routing, and init. If any logic is still in main.js that belongs in a module, extract it.

- [ ] **Step 2: Remove dead code**

Search for any unreachable or unused functions/variables across all modules.

- [ ] **Step 3: Full verification**

```bash
cd planer && npm run build
```

Test the complete workflow:
1. Open `dist/index.html` via `file://` — verify it loads
2. Open `dist/index.html` via web server (`npm run preview`) — verify it loads
3. Load an image (JPG, PNG, PDF)
4. Set scale with reference tool
5. Draw distance, area, circle, arc measurements
6. Draw pipes, add Hilfslinien, verify dim-lines
7. Undo/redo through all operations
8. Save project → load project
9. Export PDF, PNG
10. Test on mobile: touch drawing, pinch-zoom, drawer
11. Test material calculator
12. Test pipe export/import (Leitungen einmessen)

- [ ] **Step 4: Commit**

```bash
git add planer/
git commit -m "refactor: cleanup main.js, complete modularization"
```

- [ ] **Step 5: Final push**

```bash
git push
```

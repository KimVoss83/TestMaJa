# Planer App Modularization — Design Spec

## Goal

Split the monolithic `index-1.html` (~8700 lines) into ~30 ES modules with a Vite build system. The build output remains a single HTML file that works via `file://` and on web servers — identical deployment to today.

## Motivation

- **Claude Code efficiency:** Small focused files (100-400 lines) instead of one 8700-line file. Less context needed per edit, more reliable changes.
- **Developer clarity:** Each module has one responsibility, clear imports/exports.
- **Stability:** Errors are isolated to modules. Easier to test, debug, and reason about.

## Architecture

### Build System

- **Vite** as dev server and bundler
- **vite-plugin-singlefile** to inline all JS + CSS into one HTML file
- CDN libraries (Fabric.js 5.3.1, jsPDF 2.5.1, PDF.js 3.11.174, exifr 7.1.3) stay as `<script>` tags in HTML — not bundled
- Google Fonts `@import` stays in CSS as-is (requires internet, same as today)
- `npm run dev` → Vite dev server with hot reload (localhost:5173)
- `npm run build` → `dist/index.html` (single file, works via `file://`)
- Build target: `es2020` (Safari 14+, Chrome 80+)

**Note:** `file://` output requires internet for CDN scripts and fonts — this is identical to current behavior, no regression.

### Module Structure

```
planer/
├── index.html                  ← HTML skeleton + CSS (~1900 lines from monolith)
├── src/
│   ├── main.js                 ← Entry: imports all, registers canvas events, keyboard, init
│   ├── state.js                ← state object, PIPE_TYPES, measureId, CANVAS_SERIAL_PROPS,
│   │                              _isTouchDevice, TOUCH_SCALE
│   ├── canvas.js               ← Fabric.js Canvas instance, _safeHandler, pan/zoom
│   │                              (setZoom, zoomToFit, startPan, stopPan, showZoomHUD)
│   ├── undo.js                 ← history object, getSnapshot, saveSnapshot, restoreSnapshot,
│   │                              undo, redo — accepts UI update callbacks (no circular imports)
│   ├── tools/
│   │   ├── tool-manager.js     ← setTool, requireScale, TOOL_NAMES, TOOL_HINTS, button init
│   │   ├── select.js           ← Selection logic, pipe-edit entry point
│   │   ├── ref.js              ← Scale calibration (handleRefClick, promptReference, updateRefStatus)
│   │   ├── distance.js         ← Distance measurement
│   │   ├── area.js             ← Area measurement (polygon)
│   │   ├── circle.js           ← Circle tool
│   │   ├── arc.js              ← Arc/sector tool
│   │   ├── pipe.js             ← Pipe drawing + editing + vertex handling +
│   │   │                          sendPipesToBack, offsetOverlappingPipes
│   │   ├── pipe-refs.js        ← Hilfslinien/Hilfspunkte (create, remove, toggle, list)
│   │   └── label.js            ← Label tool, editLabel, updateLiveLabel, removeLiveLabel
│   ├── ui/
│   │   ├── sidebar.js          ← Accordion toggle, sidebar resize, measurement list,
│   │   │                          updatePipePanel, resizeLabelCluster
│   │   ├── modals.js           ← createModal, showToast, showMeasurementToast
│   │   ├── statusbar.js        ← Status bar updates, _notifyBadge
│   │   ├── grid.js             ← Grid overlay rendering
│   │   ├── pipe-legend.js      ← Pipe type legend display
│   │   ├── pipe-guides.js      ← Dim-line compute + render (computeDimLine,
│   │   │                          renderDimLinesForPipe, clearDimLinesForPipe)
│   │   ├── pipe-assign.js      ← Assign mode (startAssignMode, endAssignMode,
│   │   │                          toggleRefAssignment, confirmAssignMode)
│   │   ├── materialrechner.js  ← MATERIALS data + calculator UI
│   │   └── whats-new.js        ← Release notes parsing, renderWhatsNew, bug report modal
│   ├── mobile/
│   │   ├── touch.js            ← Touch capture, pinch/pan, magnifier, crosshair, finish button
│   │   └── drawer.js           ← Mobile drawer, bottom toolbar, menu
│   ├── io/
│   │   ├── image-loader.js     ← Image/PDF loading, fit-to-screen, drag-and-drop handler
│   │   ├── photogrammetry.js   ← EXIF/SENSOR_DB, calcGSD, calcAccuracy,
│   │   │                          flightRecommendation, accuracy detail panel
│   │   ├── save-load.js        ← Project JSON save/load, save/load dialog UI
│   │   ├── export.js           ← PDF/PNG export
│   │   ├── pipe-transfer.js    ← Pipe export/import with anchor alignment
│   │   │                          (_anchorExport, _anchorImport, handleLeitungenAlignClick)
│   │   └── library.js          ← Built-in library + custom library (IndexedDB, File System API)
│   ├── onboarding/
│   │   ├── welcome.js          ← Welcome onboarding flow
│   │   └── ref-onboarding.js   ← Reference tool onboarding flow
│   └── utils/
│       ├── loupe.js            ← Desktop magnifier (loupe IIFE → module)
│       └── helpers.js          ← addEndpointDot, addLabel, cancelDrawing, snapToPixel,
│                                  formatDistance, formatArea, formatErr, polygonArea, ptDist,
│                                  addRefEndmarks, addTickMarks, pointToSegmentDist,
│                                  projectPointOnLine, closestPointOnSegment
├── vite.config.js
└── package.json
```

### Module Responsibilities

#### Core Modules

**`state.js`** — Single source of truth. Exports: `state` object, `PIPE_TYPES`, `measureId` counter, `CANVAS_SERIAL_PROPS`, `_isTouchDevice`, `TOUCH_SCALE`. Every module that needs state imports from here.

**`canvas.js`** — Creates and exports the Fabric.js `canvas` instance. Exports `_safeHandler()` for wrapping event callbacks. Also contains pan/zoom logic (`setZoom`, `zoomToFit`, `startPan`, `stopPan`, `showZoomHUD`, wheel handler). Depends on: `state.js`.

**`undo.js`** — Exports `history` object, `getSnapshot()`, `saveSnapshot()`, `restoreSnapshot()`, `undo()`, `redo()`, `updateUndoRedoButtons()`.

**Circular dependency prevention:** `restoreSnapshot` needs to call UI update functions (`updateRefStatus`, `updateMeasurementList`, `updatePipeLegend`, `updatePipeRefList`, `updatePipePanel`, `renderAllDimLines`). Instead of importing these directly, `undo.js` accepts a callback registry: `registerRestoreHook(fn)`. Each module calls `registerRestoreHook` with its own update function. `restoreSnapshot` iterates the hooks after restoring state. This keeps `undo.js` dependency-free.

**`main.js`** — Entry point. Imports all modules, registers canvas event handlers (~300 lines of routing: `mouse:down`, `mouse:move`, `mouse:up`, `object:moving`, `object:modified`, `mouse:dblclick`), wires up DOM event listeners (buttons, keyboard shortcuts: Delete, Escape, Ctrl+Z/Y), calls initialization, handles window resize.

**Inline `onclick` handlers:** The monolith uses inline `onclick` attributes in dynamically generated HTML (e.g., `onclick="removeMeasurement(${id})"`). These require global function access. Solution: each module that generates such HTML explicitly exposes its functions on `window` (e.g., `window.removeMeasurement = removeMeasurement`). This is pragmatic for migration — can be refactored to event delegation later.

#### Tool Modules (`tools/`)

Each tool module exports its click/interaction handlers. All follow the same pattern:
- Import `state` from `state.js`, `canvas` from `canvas.js`, `saveSnapshot` from `undo.js`
- Export handler functions (e.g., `handleDistanceClick`, `finishDistance`)
- `main.js` routes canvas events to the correct tool handler based on `state.tool`

**`tool-manager.js`** — Exports `setTool()` which handles tool switching: button state, cursor, hints, mode cleanup. Imported by `main.js` and toolbar button handlers.

**`pipe.js`** — Largest tool module (~350 lines). Includes pipe drawing, editing (startPipeEdit, endPipeEdit), vertex manipulation (insert, delete), handle dragging (updatePipeFromHandles), and z-ordering (`sendPipesToBack`, `offsetOverlappingPipes`). Depends on: `pipe-refs.js`.

**`pipe-refs.js`** — Hilfslinien/Hilfspunkte management. Exports create/remove/toggle functions and `updatePipeRefList()`. Used by `pipe.js` and `pipe-guides.js`.

**`label.js`** — Label tool, `editLabel`, `updateLiveLabel`, `removeLiveLabel` (floating measurement preview).

#### UI Modules (`ui/`)

**`sidebar.js`** — Accordion panel logic (`toggleAcc`), sidebar resize handler, `updateMeasurementList()`, `updatePipePanel()`, `resizeLabelCluster()`. Imports `state.js` for measurement data.

**`modals.js`** — Generic `createModal()`, `showToast()`, `showMeasurementToast()`. No state dependency — pure UI utilities.

**`statusbar.js`** — Status bar text updates, `_notifyBadge()` for accordion header badges.

**`pipe-guides.js`** — Dim-line computation and rendering (~350 lines after splitting). `computeDimLine`, `renderDimLinesForPipe`, `renderAllDimLines`, `clearDimLinesForPipe`, draggable foot handlers. Depends on: `state.js`, `canvas.js`, `pipe-refs.js`.

**`pipe-assign.js`** — Assign mode (~180 lines): `startAssignMode`, `endAssignMode`, `confirmAssignMode`, `cancelAssignMode`, `toggleRefAssignment`, `directToggleRef`. Depends on: `state.js`, `canvas.js`, `pipe-refs.js`.

**`grid.js`** — Self-contained grid overlay. Reads `state.scale` to compute grid spacing.

**`materialrechner.js`** — MATERIALS constant + calculation UI (~430 lines, borderline — acceptable as single module since it's purely self-contained).

**`whats-new.js`** — Release notes parsing from HTML comment, `renderWhatsNew`, popover toggle, bug report modal.

#### Mobile Modules (`mobile/`)

**`touch.js`** — Touch capture-phase handlers on `canvas.upperCanvasEl`, pinch-to-zoom, two-finger pan, point justification with magnifier, mobile crosshair, finish button. Depends on: `state.js`, `canvas.js`.

**`drawer.js`** — Mobile sidebar drawer, bottom toolbar, hamburger menu, orientation change handler. Mostly DOM manipulation.

#### IO Modules (`io/`)

**`image-loader.js`** — `loadImageFromDataUrl()`, `loadFileAuto()`, `loadPdf()`, fit-to-screen logic, drag-and-drop file handler. Sets `state.backgroundImage`, `state.imgDisplayScale`. (~150 lines)

**`photogrammetry.js`** — SENSOR_DB, `lookupSensor`, `calcGSD`, `calcAccuracy`, `calcRequiredForTarget`, `calcFlightRecommendation`, `flightRecommendationTableHTML`, `showAccuracyDetail`, `hideAccuracyDetail`. (~350 lines)

**`save-load.js`** — Project JSON save/load, the central save/load dialog UI.

**`export.js`** — PDF export (via jsPDF), PNG export. (~160 lines)

**`pipe-transfer.js`** — Pipe export/import with anchor-based alignment workflow (~525 lines). Contains `_anchorExport`, `_anchorImport` state machines, `handleLeitungenAlignClick`, `doExportLeitungen`, `doImportLeitungen`, banner UI. This is a complex self-contained workflow.

**`library.js`** — Built-in SVG library (`LIBRARY` constant), custom library via IndexedDB/File System API.

#### Utility Modules (`utils/`)

**`loupe.js`** — Desktop magnifier. Currently an IIFE, becomes a module exporting `show()`, `hide()`, `update()`.

**`helpers.js`** — Pure functions + small canvas utilities: `addEndpointDot()`, `addLabel()`, `cancelDrawing()`, `snapToPixel()`, `formatDistance()`, `formatArea()`, `formatErr()`, `distErr_m()`, `areaRelErr_pct()`, `polygonArea()`, `ptDist()`, `addRefEndmarks()`, `addTickMarks()`, `pointToSegmentDist()`, `projectPointOnLine()`, `closestPointOnSegment()`.

### Dependency Graph (simplified)

```
state.js  ←── everything
canvas.js ←── everything that touches Fabric
undo.js   ←── all tools (saveSnapshot); accepts restore hooks, no UI imports
modals.js ←── tools (createModal), io modules (showToast)
helpers.js ←── tools, io modules, pipe-guides

main.js ──→ imports all, wires everything together, registers restore hooks
```

No circular dependencies. `state.js` and `canvas.js` are leaf nodes (they don't import other app modules). `undo.js` uses a hook registry pattern to call UI updates without importing UI modules.

### CDN Libraries

Remain as `<script>` tags in `index.html`, accessed via globals:
- `window.fabric` → Fabric.js 5.3.1
- `window.jspdf` → jsPDF 2.5.1
- `window.pdfjsLib` → PDF.js 3.11.174
- `window.exifr` → exifr 7.1.3

Vite config declares these as external/global so they're not bundled.

## Migration Strategy

**Incremental, not big-bang.** After each step, `npm run build` produces a working single-file app.

### Phase 1: Scaffold
1. Set up Vite project (`package.json`, `vite.config.js`)
2. Extract HTML + CSS from monolith into `index.html`
3. Remaining JS goes into `src/main.js` as-is (working baseline)

### Phase 2: Core Extraction
4. Extract `state.js` (state object, PIPE_TYPES, measureId, CANVAS_SERIAL_PROPS, _isTouchDevice, TOUCH_SCALE)
5. Extract `canvas.js` (canvas creation, _safeHandler, pan/zoom)
6. Extract `undo.js` (history, snapshot system, restore hook registry)

### Phase 3: Loosely-Coupled Modules (easy wins)
7. `utils/helpers.js` — pure functions + small utilities
8. `ui/materialrechner.js` — self-contained
9. `ui/grid.js` — self-contained
10. `utils/loupe.js` — IIFE → module
11. `ui/modals.js` — createModal, showToast
12. `onboarding/welcome.js` + `onboarding/ref-onboarding.js`
13. `ui/whats-new.js` — release notes + bug report

### Phase 4: Tools
14. `tools/tool-manager.js` — setTool + button init
15. `tools/distance.js`, `tools/area.js`, `tools/circle.js`, `tools/arc.js` — simple tools
16. `tools/label.js` — labels + live label
17. `tools/ref.js` — scale calibration
18. `tools/pipe-refs.js` — Hilfslinien
19. `tools/pipe.js` — pipe drawing + editing (largest tool module)
20. `tools/select.js` — selection routing

### Phase 5: Complex Subsystems
21. `ui/pipe-guides.js` + `ui/pipe-assign.js` — dim-lines + assign mode
22. `ui/pipe-legend.js` + `ui/sidebar.js` + `ui/statusbar.js`
23. `io/image-loader.js` + `io/photogrammetry.js`
24. `io/save-load.js` — project persistence
25. `io/export.js` + `io/pipe-transfer.js`
26. `io/library.js` — built-in + custom library

### Phase 6: Mobile
27. `mobile/touch.js` — touch capture, magnifier, pinch/pan, finish button
28. `mobile/drawer.js` — mobile UI chrome + orientation handler

### Phase 7: Cleanup
29. `main.js` contains only: imports, event registration (~300 lines routing), keyboard handler, init calls, window resize
30. Remove dead code, verify all paths work
31. Final `npm run build` → test `dist/index.html` via `file://` and web server

## Verification

After each extraction step:
1. `npm run build` succeeds
2. `dist/index.html` opens in browser
3. Core workflow works: load image → set scale → draw measurements → save/load
4. Mobile workflow works: touch tools, pinch-zoom, drawer
5. Pipe workflow works: draw pipes, add refs, dim-lines display
6. Undo/redo works through all operations
7. PDF/PNG export works

## Not In Scope

- TypeScript (can be added later, per-file)
- UI framework (React/Vue/Svelte)
- New features or behavior changes
- Test framework (can be added later, modules make it possible)
- feldaufnahme.html (separate app, not part of this effort)

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
- `npm run dev` → Vite dev server with hot reload (localhost:5173)
- `npm run build` → `dist/index.html` (single file, works via `file://`)
- Build target: `es2020` (Safari 14+, Chrome 80+)

### Module Structure

```
planer/
├── index.html                  ← HTML skeleton + CSS (~1900 lines from monolith)
├── src/
│   ├── main.js                 ← Entry: imports all modules, registers events, starts app
│   ├── state.js                ← Central state object, PIPE_TYPES, measureId counter
│   ├── canvas.js               ← Fabric.js Canvas instance, _safeHandler wrapper
│   ├── undo.js                 ← getSnapshot, saveSnapshot, restoreSnapshot, undo, redo
│   ├── tools/
│   │   ├── tool-manager.js     ← setTool, requireScale, TOOL_NAMES, TOOL_HINTS, button init
│   │   ├── select.js           ← Selection logic, pipe-edit entry point
│   │   ├── ref.js              ← Scale calibration (handleRefClick, promptReference, updateRefStatus)
│   │   ├── distance.js         ← Distance measurement
│   │   ├── area.js             ← Area measurement (polygon)
│   │   ├── circle.js           ← Circle tool
│   │   ├── arc.js              ← Arc/sector tool
│   │   ├── pipe.js             ← Pipe drawing + editing + vertex handling
│   │   ├── pipe-refs.js        ← Hilfslinien/Hilfspunkte (create, remove, toggle, list)
│   │   └── label.js            ← Label tool + editLabel
│   ├── ui/
│   │   ├── sidebar.js          ← Accordion toggle, sidebar resize, measurement list
│   │   ├── modals.js           ← createModal, showToast, showMeasurementToast
│   │   ├── statusbar.js        ← Status bar updates, badge notifications
│   │   ├── grid.js             ← Grid overlay rendering
│   │   ├── pipe-legend.js      ← Pipe type legend display
│   │   ├── pipe-guides.js      ← Distance-to-reference dim lines (compute, render, clear)
│   │   └── materialrechner.js  ← Material calculator (data + UI)
│   ├── mobile/
│   │   ├── touch.js            ← Touch capture, pinch/pan, point justification, magnifier
│   │   ├── drawer.js           ← Mobile drawer, bottom toolbar, menu
│   │   └── finish-btn.js       ← Finish button for multi-point operations
│   ├── io/
│   │   ├── image-loader.js     ← Image/PDF loading, EXIF reading, fit-to-screen
│   │   ├── save-load.js        ← Project save/load (JSON format)
│   │   ├── export.js           ← PDF/PNG export, pipe export/import workflow
│   │   └── library.js          ← Built-in library + custom library (IndexedDB, File System API)
│   ├── onboarding/
│   │   └── onboarding.js       ← Welcome onboarding + reference tool onboarding
│   └── utils/
│       ├── geometry.js         ← pointToSegmentDist, projectPointOnLine, closestPointOnSegment
│       ├── loupe.js            ← Desktop magnifier (loupe IIFE → module)
│       └── helpers.js          ← addEndpointDot, addLabel, cancelDrawing, snapToPixel
├── vite.config.js
└── package.json
```

### Module Responsibilities

#### Core Modules

**`state.js`** — Single source of truth. Exports the `state` object, `PIPE_TYPES` constant, and `measureId` counter. Every module that needs state imports from here.

**`canvas.js`** — Creates and exports the Fabric.js `canvas` instance. Exports `_safeHandler()` for wrapping event callbacks. Depends on: `state.js` (for `CANVAS_SERIAL_PROPS`).

**`undo.js`** — Exports `getSnapshot()`, `saveSnapshot()`, `restoreSnapshot()`, `undo()`, `redo()`, `updateUndoRedoButtons()`. Depends on: `state.js`, `canvas.js`.

**`main.js`** — Entry point. Imports all modules, registers canvas event handlers (`mouse:down`, `mouse:move`, `object:modified` etc.), wires up DOM event listeners (buttons, keyboard shortcuts), calls initialization functions. This is the only file that knows about all modules.

#### Tool Modules (`tools/`)

Each tool module exports its click/interaction handlers. All follow the same pattern:
- Import `state` from `state.js`, `canvas` from `canvas.js`, `saveSnapshot` from `undo.js`
- Export handler functions (e.g., `handleDistanceClick`, `finishDistance`)
- `main.js` routes canvas events to the correct tool handler based on `state.tool`

**`tool-manager.js`** — Exports `setTool()` which handles tool switching: button state, cursor, hints, mode cleanup. Imported by `main.js` and toolbar button handlers.

**`pipe.js`** — Largest tool module. Includes pipe drawing, editing (startPipeEdit, endPipeEdit), vertex manipulation (insert, delete), and handle dragging (updatePipeFromHandles). Depends on: `pipe-refs.js` for reference data.

**`pipe-refs.js`** — Hilfslinien/Hilfspunkte management. Exports create/remove/toggle functions and `updatePipeRefList()`. Used by `pipe.js` and `pipe-guides.js`.

#### UI Modules (`ui/`)

**`sidebar.js`** — Accordion panel logic, sidebar resize handler, `updateMeasurementList()`. Imports `state.js` for measurement data.

**`modals.js`** — Generic `createModal()` and `showToast()`. No state dependency — pure UI utilities.

**`pipe-guides.js`** — The dim-line visualization system (~578 lines in monolith). Computes and renders distance annotations between pipes and reference lines. Depends on: `state.js`, `canvas.js`, `pipe-refs.js`.

**`grid.js`** — Self-contained grid overlay. Reads `state.scale` to compute grid spacing.

**`materialrechner.js`** — Pure data (MATERIALS constant) + calculation UI. Minimal dependencies.

#### Mobile Modules (`mobile/`)

**`touch.js`** — Touch capture-phase handlers on `canvas.upperCanvasEl`, pinch-to-zoom, two-finger pan, point justification with magnifier, mobile crosshair. Depends on: `state.js`, `canvas.js`.

**`drawer.js`** — Mobile sidebar drawer, bottom toolbar, hamburger menu. Mostly DOM manipulation.

**`finish-btn.js`** — Shows/hides the finish button for multi-point operations (area, pipe). Imports tool state.

#### IO Modules (`io/`)

**`image-loader.js`** — `loadImageFromDataUrl()`, `loadFileAuto()`, `loadPdf()`, EXIF parsing via exifr, photogrammetry calculations (`calcGSD`, `calcAccuracy`). Sets `state.backgroundImage`, `state.imgDisplayScale`, `state.scale`.

**`save-load.js`** — Project JSON save/load, the central save/load dialog UI.

**`export.js`** — PDF export (via jsPDF), PNG export, pipe export/import workflow (anchor-based alignment).

**`library.js`** — Built-in SVG library (`LIBRARY` constant), custom library via IndexedDB/File System API.

#### Utility Modules (`utils/`)

**`geometry.js`** — Pure functions, no state dependency. `pointToSegmentDist()`, `projectPointOnLine()`, `closestPointOnSegment()`.

**`loupe.js`** — Desktop magnifier. Currently an IIFE, becomes a module exporting `show()`, `hide()`, `update()`.

**`helpers.js`** — `addEndpointDot()`, `addLabel()`, `cancelDrawing()`, `snapToPixel()`. Small utility functions used across tools.

### Dependency Graph (simplified)

```
state.js  ←── everything
canvas.js ←── everything that touches Fabric
undo.js   ←── all tools (saveSnapshot), main.js
modals.js ←── tools (createModal), io modules (showToast)
geometry.js ←── pipe-guides.js, pipe.js, tools
helpers.js ←── tools, io modules

main.js ──→ imports all, wires everything together
```

No circular dependencies. `state.js` and `canvas.js` are leaf nodes (they don't import other app modules).

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
4. Extract `state.js` (state object, PIPE_TYPES, measureId)
5. Extract `canvas.js` (canvas creation, _safeHandler)
6. Extract `undo.js` (snapshot system)

### Phase 3: Loosely-Coupled Modules (easy wins)
7. `utils/geometry.js` — pure functions
8. `ui/materialrechner.js` — self-contained
9. `ui/grid.js` — self-contained
10. `utils/loupe.js` — IIFE → module
11. `ui/modals.js` — createModal, showToast
12. `onboarding/onboarding.js` — welcome + ref flows

### Phase 4: Tools
13. `tools/tool-manager.js` — setTool + button init
14. `tools/distance.js`, `tools/area.js`, `tools/circle.js`, `tools/arc.js` — simple tools
15. `tools/label.js`
16. `tools/ref.js` — scale calibration (depends on EXIF data)
17. `tools/pipe-refs.js` — Hilfslinien
18. `tools/pipe.js` — pipe drawing + editing (largest tool module)
19. `tools/select.js` — selection routing

### Phase 5: Complex Subsystems
20. `ui/pipe-guides.js` — dim-line system (~578 lines)
21. `ui/pipe-legend.js` + `ui/sidebar.js` + `ui/statusbar.js`
22. `io/image-loader.js` — image/PDF/EXIF
23. `io/save-load.js` — project persistence
24. `io/export.js` — PDF/PNG/pipe export
25. `io/library.js` — built-in + custom library

### Phase 6: Mobile
26. `mobile/touch.js` — touch capture, magnifier, pinch/pan
27. `mobile/drawer.js` — mobile UI chrome
28. `mobile/finish-btn.js`

### Phase 7: Cleanup
29. `main.js` contains only: imports, event registration, init calls
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

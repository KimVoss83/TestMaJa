# Mobile Feld-Optimierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the garden/utility planning app usable on smartphones in the field, specifically for drawing pipes and measuring distances.

**Architecture:** All changes are in the single file `index-1.html`. Touch-specific behavior is gated behind `_isTouchDevice` (JS) and `.touch-device` (CSS). Desktop UX is completely unchanged. Four components: crosshair touch system, sticky bottom toolbar, long-press pan, touch scaling.

**Tech Stack:** HTML5, CSS3, JavaScript (vanilla), Fabric.js 5.3.1

**Spec:** `docs/superpowers/specs/2026-03-21-mobile-field-mode-design.md`

---

### Task 1: TOUCH_SCALE Constant + Scaled Rendering

Introduce the `TOUCH_SCALE` constant and apply it to all measurement rendering functions. This is the foundation that other tasks build on.

**Files:**
- Modify: `index-1.html:7467-7468` (after `_isTouchDevice` detection)
- Modify: `index-1.html:5643-5662` (`addLabel()`)
- Modify: `index-1.html:5664-5676` (`addEndpointDot()`)
- Modify: `index-1.html:5694-5708` (`addTickMarks()`)
- Modify: `index-1.html:4559-4560` (DIM_COLOR/DIM_WIDTH constants)
- Modify: `index-1.html:4568-4697` (`renderDimLinesForPipe()`)
- Modify: `index-1.html:3375-3390` (`showZoomHUD()`)

- [ ] **Step 1: Add TOUCH_SCALE constant**

Right after line 7468 (`if (_isTouchDevice) document.documentElement.classList.add('touch-device');`), add:

```javascript
const TOUCH_SCALE = _isTouchDevice ? 1.5 : 1.0;
```

- [ ] **Step 2: Scale `addLabel()` font size**

In `addLabel()` (line ~5643), change the fontSize line from:
```javascript
    fontSize: state.fontSize,
```
to:
```javascript
    fontSize: state.fontSize * TOUCH_SCALE,
```

Also change `fontWeight: 'bold'` — it's already bold, no change needed. Add halo scaling:
```javascript
    padding: isLight ? Math.round(3 * TOUCH_SCALE) : 0,
```

- [ ] **Step 3: Scale `addEndpointDot()` radius**

In `addEndpointDot()` (line ~5664), change:
```javascript
    left: x, top: y, radius: 1,
```
to:
```javascript
    left: x, top: y, radius: 1 * TOUCH_SCALE,
```

And scale the stroke:
```javascript
    fill: color, stroke: '#ffffff', strokeWidth: 0.3 * TOUCH_SCALE,
```

- [ ] **Step 4: Scale `addTickMarks()` offset**

In `addTickMarks()` (line ~5694), change:
```javascript
  const nx = -dy / len * 4;
  const ny =  dx / len * 4;
```
to:
```javascript
  const nx = -dy / len * 4 * TOUCH_SCALE;
  const ny =  dx / len * 4 * TOUCH_SCALE;
```

And scale stroke:
```javascript
      stroke: color, strokeWidth: 0.5 * TOUCH_SCALE,
```

- [ ] **Step 4b: Scale `addRefEndmarks()` offset**

`addRefEndmarks()` (line ~5678) has the same hardcoded `4` and `0.5` values as `addTickMarks()`. Apply the same scaling:

Change:
```javascript
  const nx = -dy / len * 4;
  const ny =  dx / len * 4;
```
to:
```javascript
  const nx = -dy / len * 4 * TOUCH_SCALE;
  const ny =  dx / len * 4 * TOUCH_SCALE;
```

And scale stroke:
```javascript
      stroke: color, strokeWidth: 0.5 * TOUCH_SCALE,
```

- [ ] **Step 5: Scale dimension line rendering**

In `renderDimLinesForPipe()` (line ~4568), find the main line creation and scale its stroke width. Change:
```javascript
    const lw = state.lineWidth || DIM_WIDTH;
```
to:
```javascript
    const lw = (state.lineWidth || DIM_WIDTH) * TOUCH_SCALE;
```

Also scale the dimension label font size. Find the label creation (the `new fabric.Text(distLabel, {` block) and change:
```javascript
      fontSize: fs, fontWeight: 'bold', fontFamily: 'monospace',
```
to:
```javascript
      fontSize: fs * TOUCH_SCALE, fontWeight: 'bold', fontFamily: 'monospace',
```

And scale the label padding:
```javascript
      padding: 2 * TOUCH_SCALE,
```

- [ ] **Step 6: Scale Zoom HUD and status text via CSS**

Add to the existing `.touch-device` CSS block (after line 1137):

```css
html.touch-device #zoom-hud { font-size: 16px; }
html.touch-device #status-bar { font-size: 14px; }
```

- [ ] **Step 7: Test on mobile**

Open `http://localhost:8080/index-1.html` on a smartphone (or Chrome DevTools mobile emulation). Verify:
- Measurement labels are visibly larger than on desktop
- Dimension lines are thicker
- Endpoint dots are larger
- Zoom HUD text is 16px
- Desktop browser: everything looks exactly the same as before

- [ ] **Step 8: Commit**

```bash
git add index-1.html
git commit -m "feat: add TOUCH_SCALE for larger labels and lines on mobile"
```

---

### Task 2: Sticky Touch Toolbar

Add a bottom toolbar with large touch targets for the most-used tools on touch devices.

**Files:**
- Modify: `index-1.html:1136-1137` (CSS `.touch-device` block — add new styles)
- Modify: `index-1.html:1415` (after drawer toggle button — add HTML)
- Modify: `index-1.html:2086-2112` (`setTool()` — sync bottom toolbar active state)
- Modify: `index-1.html:4159-4188` (Hilfslinie/Hilfspunkt handlers — sync bottom toolbar)
- Modify: `index-1.html:7427-7462` (drawer open/close — hide/show bottom toolbar)

- [ ] **Step 1: Add CSS for the bottom toolbar**

Add after the existing `.touch-device` CSS (line ~1137):

```css
/* ── Mobile Bottom Toolbar ── */
#touch-toolbar {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 490;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(0,0,0,0.08);
  padding: 4px 4px;
  padding-bottom: max(4px, env(safe-area-inset-bottom));
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
#touch-toolbar::-webkit-scrollbar { display: none; }
html.touch-device #touch-toolbar { display: flex; }
#touch-toolbar button {
  flex: 0 0 auto;
  min-width: 44px; min-height: 44px;
  border: none; background: transparent;
  border-radius: 10px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-size: 9px; font-weight: 600; color: #666;
  font-family: inherit;
  cursor: pointer;
  padding: 2px 6px;
  gap: 1px;
}
#touch-toolbar button svg { width: 22px; height: 22px; }
#touch-toolbar button.active { background: #f0ebff; color: #7B2FBE; }
#touch-toolbar button.sub-active { background: #fff3e0; color: #E65100; }
#touch-toolbar .tt-sep {
  width: 1px; height: 28px; background: rgba(0,0,0,0.1);
  flex-shrink: 0;
}
```

Also move the drawer toggle up. Add:
```css
html.touch-device #mobile-drawer-toggle {
  bottom: 62px;
}
```

And hide the bottom toolbar when drawer is open:
```css
html.touch-device #sidebar.drawer-open ~ #touch-toolbar { display: none !important; }

/* Landscape: hide button labels to save space */
@media (orientation: landscape) {
  #touch-toolbar button span { display: none; }
  #touch-toolbar button { min-width: 40px; padding: 4px; }
}
```

- [ ] **Step 2: Add HTML for the bottom toolbar**

Right after the `<button id="mobile-drawer-toggle">` element (line ~1415), add:

```html
<div id="touch-toolbar">
  <button id="tt-select" title="Auswahl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg><span>Auswahl</span></button>
  <button id="tt-ref" title="Maßstab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M10 12h4"/></svg><span>Maßstab</span></button>
  <div class="tt-sep"></div>
  <button id="tt-pipe-ref-line" title="Hilfslinie"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23" stroke-dasharray="4 2"/><line x1="4" y1="12" x2="20" y2="12"/></svg><span>H-Linie</span></button>
  <button id="tt-pipe-ref-point" title="Hilfspunkt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg><span>H-Punkt</span></button>
  <div class="tt-sep"></div>
  <button id="tt-distance" title="Distanz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/><line x1="14" y1="13" x2="11" y2="10"/></svg><span>Distanz</span></button>
  <button id="tt-area" title="Fläche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg><span>Fläche</span></button>
  <button id="tt-circle" title="Kreis"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg><span>Kreis</span></button>
  <button id="tt-pipe" title="Leitung"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M4 12h12"/><circle cx="20" cy="12" r="2"/><path d="M4 8h8"/></svg><span>Leitung</span></button>
  <div class="tt-sep"></div>
  <button id="tt-undo" title="Rückgängig"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span>Undo</span></button>
</div>
```

- [ ] **Step 3: Add JS handlers for bottom toolbar**

Add after the drawer toggle JS block (after line ~7462):

```javascript
// =========================================================
// MOBILE: BOTTOM TOUCH TOOLBAR
// =========================================================
if (_isTouchDevice) {
  // Tool buttons: sync with setTool()
  const _ttToolMap = {
    'tt-select': 'select', 'tt-ref': 'ref', 'tt-distance': 'distance',
    'tt-area': 'area', 'tt-circle': 'circle', 'tt-pipe': 'pipe',
  };
  Object.entries(_ttToolMap).forEach(([btnId, tool]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.onclick = () => setTool(tool);
  });

  // Hilfslinie/Hilfspunkt: mirror the original button handlers
  document.getElementById('tt-pipe-ref-line').onclick = () => {
    document.getElementById('btn-pipe-ref-line').click();
  };
  document.getElementById('tt-pipe-ref-point').onclick = () => {
    document.getElementById('btn-pipe-ref-point').click();
  };

  // Undo
  document.getElementById('tt-undo').onclick = () => undo();
}
```

- [ ] **Step 4: Sync bottom toolbar active states from setTool()**

In `setTool()` (line ~2086), after the existing `Object.keys(TOOL_NAMES).forEach(...)` block that toggles active classes on the main toolbar, add:

```javascript
  // Sync mobile bottom toolbar
  if (_isTouchDevice) {
    document.querySelectorAll('#touch-toolbar button[id^="tt-"]').forEach(btn => {
      const tool = btn.id.replace('tt-', '');
      btn.classList.toggle('active', tool === t);
    });
  }
```

- [ ] **Step 5: Sync Hilfslinie/Hilfspunkt active states on bottom toolbar**

In the `btn-pipe-ref-line` onclick handler (line ~4159), after each `classList.add('active')` / `classList.remove('active')` call on `btn-pipe-ref-line`, mirror to `tt-pipe-ref-line`:

After `document.getElementById('btn-pipe-ref-line').classList.remove('active');` add:
```javascript
    document.getElementById('tt-pipe-ref-line')?.classList.remove('sub-active');
```

After `document.getElementById('btn-pipe-ref-line').classList.add('active');` add:
```javascript
    document.getElementById('tt-pipe-ref-line')?.classList.add('sub-active');
    document.getElementById('tt-pipe-ref-point')?.classList.remove('sub-active');
```

Do the same for `btn-pipe-ref-point` handler (line ~4176):

After `document.getElementById('btn-pipe-ref-point').classList.remove('active');` add:
```javascript
    document.getElementById('tt-pipe-ref-point')?.classList.remove('sub-active');
```

After `document.getElementById('btn-pipe-ref-point').classList.add('active');` add:
```javascript
    document.getElementById('tt-pipe-ref-point')?.classList.add('sub-active');
    document.getElementById('tt-pipe-ref-line')?.classList.remove('sub-active');
```

- [ ] **Step 6: Hide bottom toolbar when drawer is open**

In `openDrawer()` (line ~7435), add:
```javascript
  const tt = document.getElementById('touch-toolbar');
  if (tt) tt.style.display = 'none';
```

In `closeDrawer()` (line ~7440), add:
```javascript
  const tt = document.getElementById('touch-toolbar');
  if (tt && _isTouchDevice) tt.style.display = 'flex';
```

- [ ] **Step 7: Test on mobile**

Open on smartphone or Chrome DevTools mobile emulation. Verify:
- Bottom toolbar visible on mobile, hidden on desktop
- Tapping each button activates the correct tool
- Active tool is highlighted in both top and bottom toolbars
- Hilfslinie/Hilfspunkt buttons show orange active state
- Undo button works
- Drawer toggle is above the toolbar
- When drawer opens, bottom toolbar hides
- Horizontal scroll works if buttons don't fit

- [ ] **Step 8: Commit**

```bash
git add index-1.html
git commit -m "feat: add sticky bottom toolbar for touch devices"
```

---

### Task 3: Crosshair Touch System

Replace the simple tap-to-click with a crosshair system that shows 80px above the finger, allowing precise point placement.

**Files:**
- Modify: `index-1.html:7485-7579` (replace touch event handlers)
- Modify: `index-1.html:3046-3134` (`_loupe` — adjust coordinate source)
- Modify: `index-1.html:1136-1137` (CSS — add crosshair overlay styles)

- [ ] **Step 1: Add CSS for the crosshair overlay**

Add to the `.touch-device` CSS block:

```css
/* ── Touch Crosshair Overlay ── */
#touch-crosshair {
  display: none;
  position: fixed;
  width: 44px; height: 44px;
  pointer-events: none;
  z-index: 800;
  transform: translate(-50%, -50%);
}
#touch-crosshair .ch-v,
#touch-crosshair .ch-h {
  position: absolute; background: rgba(210,30,30,0.85);
}
#touch-crosshair .ch-v {
  width: 1.5px; height: 44px; left: 50%; top: 0; transform: translateX(-50%);
}
#touch-crosshair .ch-h {
  width: 44px; height: 1.5px; top: 50%; left: 0; transform: translateY(-50%);
}
#touch-crosshair .ch-dot {
  position: absolute; width: 6px; height: 6px;
  border: 1.5px solid rgba(210,30,30,1);
  border-radius: 50%;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: rgba(255,255,255,0.7);
}
#touch-finger-dot {
  display: none;
  position: fixed;
  width: 20px; height: 20px;
  border: 2px solid rgba(210,30,30,0.4);
  border-radius: 50%;
  pointer-events: none;
  z-index: 799;
  transform: translate(-50%, -50%);
  background: rgba(210,30,30,0.08);
}
```

- [ ] **Step 2: Add crosshair HTML elements**

Add right before the closing `</body>` tag (or near the touch-toolbar HTML):

```html
<div id="touch-crosshair"><div class="ch-v"></div><div class="ch-h"></div><div class="ch-dot"></div></div>
<div id="touch-finger-dot"></div>
```

- [ ] **Step 3: Rewrite touch event handlers**

Replace the entire touch event block (lines ~7485-7579). The new code implements the crosshair system with the state machine from the spec:

```javascript
// =========================================================
// TOUCH: CROSSHAIR + GESTURE STATE MACHINE
// =========================================================
let _touchState = { type: null, lastDist: 0, lastMid: null, startTime: 0, startPos: null, committed: null };
const _CROSSHAIR_OFFSET = 80;
const _DRAG_THRESHOLD = 10;
const _LONG_PRESS_MS = 500;
const _QUICK_TAP_MS = 300;
let _longPressTimer = null;

const _chEl = document.getElementById('touch-crosshair');
const _fingerDot = document.getElementById('touch-finger-dot');

function _showCrosshair(cx, cy, fx, fy) {
  _chEl.style.left = cx + 'px';
  _chEl.style.top = cy + 'px';
  _chEl.style.display = 'block';
  _fingerDot.style.left = fx + 'px';
  _fingerDot.style.top = fy + 'px';
  _fingerDot.style.display = 'block';
}
function _hideCrosshair() {
  _chEl.style.display = 'none';
  _fingerDot.style.display = 'none';
}

function _crosshairOffset(fingerY) {
  // Flip offset downward if too close to top
  return fingerY - _CROSSHAIR_OFFSET < 10 ? _CROSSHAIR_OFFSET : -_CROSSHAIR_OFFSET;
}

function _useCrosshair() {
  return state.tool !== 'select' && state.tool !== 'label';
}

function _dispatchCanvasClick(clientX, clientY) {
  const rect = canvas.getElement().getBoundingClientRect();
  const simEvt = new MouseEvent('mousedown', {
    clientX, clientY,
    offsetX: clientX - rect.left, offsetY: clientY - rect.top,
    bubbles: true,
  });
  canvas.getElement().dispatchEvent(simEvt);
  const simUp = new MouseEvent('mouseup', {
    clientX, clientY,
    offsetX: clientX - rect.left, offsetY: clientY - rect.top,
    bubbles: true,
  });
  canvas.getElement().dispatchEvent(simUp);
}

// --- touchstart ---
wrapper.addEventListener('touchstart', e => {
  if (_touchOnOverlay(e)) return;

  if (e.touches.length === 2) {
    // Two-finger: pinch zoom (unchanged)
    e.preventDefault();
    clearTimeout(_longPressTimer);
    _hideCrosshair();
    _touchState.type = 'pinch';
    _touchState.committed = 'pinch';
    _touchState.lastDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    _touchState.lastMid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
    return;
  }

  if (e.touches.length === 1) {
    const t = e.touches[0];
    _touchState.type = 'single';
    _touchState.startTime = Date.now();
    _touchState.startPos = { x: t.clientX, y: t.clientY };
    _touchState.committed = null;
    _touchState.lastMid = { x: t.clientX, y: t.clientY };

    // Show crosshair immediately for drawing tools
    if (_useCrosshair()) {
      const offY = _crosshairOffset(t.clientY);
      _showCrosshair(t.clientX, t.clientY + offY, t.clientX, t.clientY);

      // Feed loupe with crosshair position
      const rect = canvas.getElement().getBoundingClientRect();
      const chX = t.clientX, chY = t.clientY + offY;
      _loupe.show();
      _loupe.update(chX, chY, chX - rect.left, chY - rect.top);
    }

    // Start long-press timer for pan
    _longPressTimer = setTimeout(() => {
      if (_touchState.committed) return; // Already committed to crosshair drag
      _touchState.committed = 'pan';
      _hideCrosshair();
      _loupe.hide();
      wrapper.classList.add('panning');
      canvas.defaultCursor = 'grabbing';
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(25);
    }, _LONG_PRESS_MS);
  }
}, { passive: false });

// --- touchmove ---
wrapper.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && _touchState.type === 'pinch') {
    // Pinch zoom + pan (unchanged)
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const mid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
    const factor = dist / _touchState.lastDist;
    const rect = wrapper.getBoundingClientRect();
    setZoom(canvas.getZoom() * factor, {
      x: mid.x - rect.left,
      y: mid.y - rect.top,
    });
    const dx = mid.x - _touchState.lastMid.x;
    const dy = mid.y - _touchState.lastMid.y;
    const vpt = canvas.viewportTransform.slice();
    vpt[4] += dx;
    vpt[5] += dy;
    canvas.setViewportTransform(vpt);
    _touchState.lastDist = dist;
    _touchState.lastMid = mid;
    return;
  }

  if (e.touches.length === 1 && _touchState.type === 'single') {
    const t = e.touches[0];
    const moved = Math.hypot(t.clientX - _touchState.startPos.x, t.clientY - _touchState.startPos.y);

    // Commit to crosshair mode if drag started before long-press
    if (!_touchState.committed && moved > _DRAG_THRESHOLD) {
      clearTimeout(_longPressTimer);
      _touchState.committed = _useCrosshair() ? 'crosshair' : 'fabric';
    }

    if (_touchState.committed === 'crosshair') {
      e.preventDefault();
      const offY = _crosshairOffset(t.clientY);
      _showCrosshair(t.clientX, t.clientY + offY, t.clientX, t.clientY);
      // Update loupe at crosshair position
      const rect = canvas.getElement().getBoundingClientRect();
      const chX = t.clientX, chY = t.clientY + offY;
      _loupe.show();
      _loupe.update(chX, chY, chX - rect.left, chY - rect.top);
    } else if (_touchState.committed === 'pan') {
      e.preventDefault();
      const dx = t.clientX - _touchState.lastMid.x;
      const dy = t.clientY - _touchState.lastMid.y;
      const vpt = canvas.viewportTransform.slice();
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.setViewportTransform(vpt);
    }
    // 'fabric' committed: let Fabric.js handle natively (object drag in select mode)

    _touchState.lastMid = { x: t.clientX, y: t.clientY };
  }
}, { passive: false });

// --- touchend ---
wrapper.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    clearTimeout(_longPressTimer);
    _hideCrosshair();
    _loupe.hide();

    if (_touchState.committed === 'pan') {
      wrapper.classList.remove('panning');
      canvas.defaultCursor = state.tool === 'select' ? 'default' : 'crosshair';
    } else if (_touchState.committed === 'crosshair' && e.changedTouches.length === 1) {
      // Place point at crosshair position
      const t = e.changedTouches[0];
      const offY = _crosshairOffset(t.clientY);
      _dispatchCanvasClick(t.clientX, t.clientY + offY);
    } else if (!_touchState.committed && _touchState.type === 'single') {
      // Quick tap — no drag, no long-press
      const elapsed = Date.now() - _touchState.startTime;
      if (elapsed < _QUICK_TAP_MS && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        // Quick tap: place at finger position directly (no crosshair offset)
        // This matches pre-existing behavior for fast, experienced users
        _dispatchCanvasClick(t.clientX, t.clientY);
      }
    }

    _touchState.type = null;
    _touchState.lastMid = null;
    _touchState.committed = null;
  }
}, { passive: true });
```

- [ ] **Step 4: Remove old one-finger pan in select mode**

The old touchmove handler had a one-finger pan block for `state.tool === 'select'`. This is now replaced by the long-press-pan and Fabric.js native handling. Verify the old code (lines ~7537-7550) is gone since we replaced the entire block.

- [ ] **Step 5: Test crosshair on mobile**

Open on smartphone. Verify:
- Drawing tools (distance, area, pipe, etc.): crosshair appears 80px above finger on touch
- Dragging moves crosshair, releasing places point at crosshair
- Quick tap (< 300ms) also places point at crosshair offset
- Near top of screen: crosshair flips below finger
- Loupe shows area around crosshair, not finger
- Select tool: no crosshair, objects can be tapped/dragged normally
- Two-finger: zoom/pan works as before, no crosshair
- Long-press (>500ms hold without moving): starts pan mode, crosshair disappears, vibration feedback
- Desktop: all behavior unchanged (touch code doesn't activate)

- [ ] **Step 6: Commit**

```bash
git add index-1.html
git commit -m "feat: crosshair touch system with offset for precise point placement"
```

---

### Task 4: Long-Press Pan Integration

The long-press pan is already included in Task 3's touch rewrite. This task handles the remaining integration: disabling old select-mode pan behavior on touch and ensuring Fabric.js native object handling works.

**Files:**
- Modify: `index-1.html` (verify select mode works with Fabric.js native touch)

- [ ] **Step 1: Verify Select mode object interaction**

On mobile, switch to Select tool. Verify:
- Tap on an object selects it
- Drag on an object moves it (labels, lib items, draggable foot points)
- Tap on empty canvas deselects
- Long-press + drag on empty canvas pans
- No one-finger pan when simply touching canvas (old behavior removed)

- [ ] **Step 2: Adjust if Fabric.js needs help with touch select**

If Fabric.js doesn't handle touch natively well in select mode, add this fallback in the touchend handler, inside the `!_touchState.committed && _touchState.type === 'single'` block, for the `!_useCrosshair()` case — the `_dispatchCanvasClick` already handles this. Verify it works.

- [ ] **Step 3: Test long-press pan in all tools**

Test on smartphone:
- In distance tool: long-press (hold ~1 second) then drag → canvas pans
- In pipe tool: same behavior
- In select tool: same (long-press on empty area pans)
- Release returns to previous tool, cursor resets
- Vibration feedback on long-press detection (if device supports it)

- [ ] **Step 4: Commit (if changes were needed)**

```bash
git add index-1.html
git commit -m "fix: ensure select mode object interaction works on touch"
```

---

### Task 5: Final Polish + Edge Cases

**Files:**
- Modify: `index-1.html` (various small adjustments)

- [ ] **Step 1: Ensure crosshair doesn't appear during object drag**

In the touchstart handler, check if Fabric.js has an active object under the finger. If so, skip crosshair (let Fabric handle the drag):

In the `e.touches.length === 1` block of touchstart, before showing crosshair, add:

```javascript
    // Don't show crosshair if touching a selectable/draggable object
    const pointer = canvas.getPointer(e.touches[0], true);
    const target = canvas.findTarget(e.touches[0]);
    if (target && (target.selectable || target._dimDraggableFoot)) {
      _touchState.committed = 'fabric';
      clearTimeout(_longPressTimer);
      return;
    }
```

- [ ] **Step 2: Hide crosshair when second finger touches**

Already handled: the touchstart handler for 2 fingers calls `_hideCrosshair()`. Verify this works when starting with 1 finger then adding a second.

- [ ] **Step 3: Prevent iOS Safari bounce during pan**

The existing `touchmove` prevention (line ~7477) should still work since we have `{ passive: false }`. Verify the iOS rubber-band doesn't appear during long-press pan.

The existing handler at line ~7477 should remain:
```javascript
wrapper.addEventListener('touchmove', e => {
  if (_touchOnOverlay(e)) return;
  if (e.touches.length >= 2 || state.tool !== 'select') {
    e.preventDefault();
  }
}, { passive: false });
```

Update this to also prevent default during pan mode:
```javascript
wrapper.addEventListener('touchmove', e => {
  if (_touchOnOverlay(e)) return;
  if (e.touches.length >= 2 || state.tool !== 'select' || _touchState.committed === 'pan') {
    e.preventDefault();
  }
}, { passive: false });
```

- [ ] **Step 4: Test full workflow on smartphone**

Complete field workflow test:
1. Open pre-prepared project (with image + reference line)
2. Select pipe tool from bottom toolbar
3. Use crosshair to place pipe points precisely
4. Pinch to zoom in for detail
5. Long-press to pan to different area
6. Continue placing pipe points
7. Double-tap to finish pipe
8. Switch to distance tool via bottom toolbar
9. Measure a distance with crosshair
10. Undo via bottom toolbar
11. Open drawer to check measurements
12. Close drawer, bottom toolbar reappears

Verify in both portrait and landscape orientation.

- [ ] **Step 5: Test desktop is unchanged**

Open on desktop browser. Verify:
- No bottom toolbar visible
- No crosshair elements visible
- All mouse interactions work exactly as before
- Loupe works as before
- Pan (Alt+drag, Space+drag) works
- All tools work normally

- [ ] **Step 6: Commit**

```bash
git add index-1.html
git commit -m "feat: complete mobile field mode with edge case handling"
```

- [ ] **Step 7: Push to GitHub**

```bash
git push origin main
```

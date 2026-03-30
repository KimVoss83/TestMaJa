import { state } from '../state.js';
import { canvas, wrapper } from '../canvas.js';
import { saveSnapshot } from '../undo.js';
import { _notifyBadge } from '../ui/statusbar.js';
import { endPipeEdit, offsetOverlappingPipes, updatePipePanel } from '../tools/pipe.js';
import { updatePipeLegend } from '../ui/pipe-legend.js';

// =========================================================
// MEASUREMENT LIST
// =========================================================
const TYPE_ICONS = {
  distance: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/></svg>',
  area: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  circle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  arc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2"/></svg>',
  pipe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="M4 12h12"/><circle cx="20" cy="12" r="2"/></svg>'
};
const TYPE_LABELS = { distance: 'Distanz', area: 'Fläche', circle: 'Kreis', arc: 'Kreisabschnitt', pipe: 'Leitung' };

export function updateMeasurementList() {
  updatePipePanel();
  const list = document.getElementById('measurements-list');
  const nonPipe = state.measurements.filter(m => m.type !== 'pipe').slice().reverse();
  _notifyBadge('badge-messungen', 'acc-messungen', nonPipe.length, 'messungen');
  if (!nonPipe.length) {
    list.innerHTML = '<div style="font-size:11px;color:#444;padding:3px 0;">Noch keine Messungen</div>';
    return;
  }
  list.innerHTML = nonPipe.map(m => {
    const edgeToggle = m.type === 'area'
      ? `<button class="m-edge-toggle" onclick="toggleAreaEdgeLabels(${m.id})" title="Kantenlängen ein-/ausblenden"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/></svg></button>`
      : '';
    return `
    <div class="measurement-item">
      <div class="m-label">
        <span>${TYPE_ICONS[m.type] || '•'} ${TYPE_LABELS[m.type] || m.type}</span>
        <span class="m-btns">${edgeToggle}<button class="m-calc" onclick="openMaterialCalc(${m.id})" title="Materialrechner"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg></button><button class="m-delete" onclick="removeMeasurement(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>
      </div>
      <div class="m-value">${m.label}</div>
    </div>`;
  }).join('');
}

export function removeMeasurement(id) {
  saveSnapshot();
  // If this pipe is being edited, end the edit first
  if (state.editingPipe && state.editingPipe.id === id) endPipeEdit();
  const wasPipe = state.measurements.some(m => m.id === id && m.type === 'pipe');
  canvas.getObjects().filter(o => o._measureId === id || o._dimLinePipeId === id).forEach(o => canvas.remove(o));
  state.measurements = state.measurements.filter(m => m.id !== id);
  updateMeasurementList();
  if (wasPipe) {
    updatePipeLegend();
    offsetOverlappingPipes();
  }
  canvas.renderAll();
}

// =========================================================
// SIDEBAR RESIZE
// =========================================================
export function initSidebarResize() {
  const sidebar = document.getElementById('sidebar');
  const handle  = document.getElementById('sidebar-resize-handle');
  if (!sidebar || !handle) return;

  const MIN_W = 160, MAX_W = 480;
  const STORAGE_KEY = 'gp_sidebar_w';

  // Restore saved width
  const saved = parseInt(localStorage.getItem(STORAGE_KEY));
  if (saved >= MIN_W && saved <= MAX_W) sidebar.style.width = saved + 'px';

  let startX, startW;

  function onMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = clientX - startX;
    const newW  = Math.min(MAX_W, Math.max(MIN_W, startW + delta));
    sidebar.style.width = newW + 'px';
  }

  function onUp() {
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(STORAGE_KEY, parseInt(sidebar.style.width));
    // Trigger canvas resize so Fabric + grid canvas stay in sync
    canvas.setWidth(wrapper.clientWidth);
    canvas.setHeight(wrapper.clientHeight);
    const gc = document.getElementById('grid-canvas');
    if (gc) { gc.width = wrapper.clientWidth; gc.height = wrapper.clientHeight; }
    canvas.renderAll();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onUp);
  }

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  handle.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend',  onUp);
  }, { passive: true });
}

// =========================================================
// AKKORDEON SIDEBAR
// =========================================================
export function toggleAcc(header) {
  const section = header.closest('.acc-section');
  section.classList.toggle('open');
  if (section.classList.contains('open')) {
    const badge = section.querySelector('.acc-badge');
    if (badge) badge.classList.remove('visible');
  }
}

export function openAccSection(id) {
  const sec = document.getElementById(id);
  if (sec) { sec.classList.add('open'); const b = sec.querySelector('.acc-badge'); if (b) b.classList.remove('visible'); }
}

// =========================================================
// SCHRIFTGRÖSSEN-CLUSTER
// =========================================================
export function resizeLabelCluster(clusterKey, newSize) {
  newSize = parseInt(newSize);
  if (!newSize || newSize < 4 || newSize > 72) return;
  canvas.getObjects().filter(o => {
    if (o.type !== 'text') return false;
    switch (clusterKey) {
      case 'measure': return o._measureId != null && !o._userLabel;
      case 'label':   return o._userLabel === true;
      case 'ref':     return o._measureId == null && !o._userLabel && !o._pipeRefType && !o._isPipeLegend;
      case 'guide':   return o._pipeRefType === 'line-label' || o._pipeRefType === 'point-label';
    }
    return false;
  }).forEach(o => o.set({ fontSize: newSize }));
  canvas.renderAll();
}

// Expose for inline onclick handlers in HTML and in pipe panel HTML
window.toggleAcc = toggleAcc;
window.removeMeasurement = removeMeasurement;

function toggleAreaEdgeLabels(measureId) {
  const edgeLabels = canvas.getObjects().filter(o => o._measureId === measureId && o._areaEdgeLabel);
  if (!edgeLabels.length) return;
  const visible = edgeLabels[0].visible !== false;
  edgeLabels.forEach(l => { l.visible = !visible; });
  canvas.renderAll();
}
window.toggleAreaEdgeLabels = toggleAreaEdgeLabels;

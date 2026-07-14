import { state, CANVAS_SERIAL_PROPS, setMeasureId, measureId } from './state.js';
import { canvas } from './canvas.js';

export const history = { past: [], future: [], MAX: 40, _paused: false, _restoring: false };

const _restoreHooks = [];
export function registerRestoreHook(fn) { _restoreHooks.push(fn); }

export function getSnapshot() {
  const json = canvas.toJSON(CANVAS_SERIAL_PROPS);
  json.objects = (json.objects || []).filter(o => !o._isBackground && o._dimLinePipeId == null);
  return {
    canvas:        JSON.stringify(json),
    measurements:  JSON.stringify(state.measurements),
    pipeRefs:      JSON.stringify(state.pipeReferences),
    activePipeRefs:JSON.stringify(state.activePipeRefs),
    scale:         state.scale,
    scaleSource:   state.scaleSource,
    refLines:      JSON.stringify(state.refLines),
    refSumL2:      state.refSumL2,
    measureId:     measureId,
  };
}

export function saveSnapshot() {
  if (history._paused) return;
  history.past.push(getSnapshot());
  if (history.past.length > history.MAX) history.past.shift();
  history.future = [];
  updateUndoRedoButtons();
}

export function restoreSnapshot(snap) {
  history._paused = true;
  history._restoring = true;
  const bg = state.backgroundImage;
  try {
    canvas.loadFromJSON(JSON.parse(snap.canvas), () => {
      try {
        if (bg) { canvas.add(bg); canvas.sendToBack(bg); }
        state.backgroundImage  = bg;
        state.measurements     = JSON.parse(snap.measurements);
        state.pipeReferences   = JSON.parse(snap.pipeRefs);
        state.activePipeRefs   = JSON.parse(snap.activePipeRefs);
        state.scale            = snap.scale;
        state.scaleSource      = snap.scaleSource;
        state.refLines         = JSON.parse(snap.refLines);
        state.refSumL2         = snap.refSumL2;
        setMeasureId(snap.measureId);

        // Integrity checks
        const validRefIds = new Set(state.pipeReferences.map(r => r.id));
        state.activePipeRefs = state.activePipeRefs.filter(id => validRefIds.has(id));
        state.measurements.forEach(m => {
          if (Array.isArray(m.refs)) {
            m.refs = m.refs.filter(id => validRefIds.has(id));
          }
        });

        // Call registered restore hooks instead of direct function calls
        _restoreHooks.forEach(fn => {
          try { fn(); }
          catch (e) { console.error('Restore hook error:', e); }
        });

        canvas.renderAll();
        canvas.getObjects().filter(o => o._dimLinePipeId != null).forEach(o => canvas.remove(o));
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

export function undo() {
  if (history._restoring || !history.past.length) return;
  history.future.push(getSnapshot());
  restoreSnapshot(history.past.pop());
}

export function redo() {
  if (history._restoring || !history.future.length) return;
  history.past.push(getSnapshot());
  restoreSnapshot(history.future.pop());
}

export function updateUndoRedoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = history._restoring || history.past.length === 0;
  if (r) r.disabled = history._restoring || history.future.length === 0;
}

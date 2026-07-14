import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { addLabel } from '../utils/helpers.js';
import { createModal } from '../ui/modals.js';

// =========================================================
// LABEL TOOL
// =========================================================
export function handleLabelClick(p) {
  createModal('Beschriftung',
    `<input type="text" id="label-input" placeholder="Text eingeben …" />`,
    () => {
      const txt = document.getElementById('label-input').value.trim();
      if (txt) addLabel(p.x, p.y, txt, state.color, null, true);
    }
  );
  setTimeout(() => document.getElementById('label-input')?.focus(), 80);
}

export function editLabel(labelObj) {
  createModal('Beschriftung bearbeiten',
    `<input type="text" id="label-input" value="${labelObj.text.replace(/"/g, '&quot;')}" />`,
    () => {
      const newText = document.getElementById('label-input').value.trim();
      if (newText) {
        labelObj.set({ text: newText });
        canvas.renderAll();
      } else {
        // Leerer Text → Label entfernen
        canvas.remove(labelObj);
        canvas.renderAll();
      }
    }
  );
  setTimeout(() => {
    const inp = document.getElementById('label-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 80);
}

// =========================================================
// LIVE LABEL (schwebendes Maß während des Zeichnens)
// =========================================================
let _liveLabel = null;

export function updateLiveLabel(p1, p2, text) {
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const offX = -Math.sin(angle) * 16;
  const offY =  Math.cos(angle) * 16;
  if (_liveLabel) {
    _liveLabel.set({ left: mx + offX, top: my + offY, text: text });
  } else {
    _liveLabel = new fabric.Text(text, {
      left: mx + offX, top: my + offY,
      fontSize: state.fontSize,
      fill: '#000000',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      backgroundColor: 'rgba(255,255,255,0.88)',
      padding: 3,
      originX: 'center', originY: 'center',
      selectable: false, evented: false,
      _noSelect: true, _liveLabel: true,
    });
    canvas.add(_liveLabel);
  }
}

export function removeLiveLabel() {
  if (_liveLabel) {
    canvas.remove(_liveLabel);
    _liveLabel = null;
  }
}

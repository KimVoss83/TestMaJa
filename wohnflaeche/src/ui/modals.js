import { _isTouchDevice } from '../state.js';

const TOAST_COLORS = {
  error:   'rgba(220,38,38,0.93)',
  warning: 'rgba(217,119,6,0.93)',
  success: 'rgba(22,163,74,0.93)',
  info:    'rgba(37,99,235,0.93)',
};

export function showToast(msg, type = 'error') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `position:fixed;bottom:48px;left:50%;transform:translateX(-50%);
      color:#fff;padding:9px 22px;border-radius:22px;
      font-size:13px;font-weight:600;z-index:2000;pointer-events:none;
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      box-shadow:0 8px 24px rgba(0,0,0,0.18);transition:opacity 0.3s,background 0.2s;
      font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:-0.2px;`;
    document.body.appendChild(t);
  }
  t.style.background = TOAST_COLORS[type] || TOAST_COLORS.error;
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, type === 'error' ? 4500 : 3000);
}

// Haptisches Feedback (nur Mobile, nur wenn unterstützt)
export function haptic(style = 'light') {
  if (!navigator.vibrate) return;
  switch (style) {
    case 'light':  navigator.vibrate(10); break;
    case 'medium': navigator.vibrate(20); break;
    case 'heavy':  navigator.vibrate([15, 30, 15]); break;
  }
}

// Messergebnis als großen Toast anzeigen (nur Mobile)
export function showMeasurementToast(text) {
  if (!_isTouchDevice) return;
  let t = document.getElementById('measure-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'measure-toast';
    t.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.8);
      color:#fff;padding:16px 32px;border-radius:16px;font-size:28px;font-weight:700;
      z-index:2001;pointer-events:none;background:rgba(0,0,0,0.75);
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      box-shadow:0 8px 32px rgba(0,0,0,0.3);transition:opacity 0.4s,transform 0.3s;
      font-family:'DM Sans',-apple-system,sans-serif;letter-spacing:-0.5px;opacity:0;`;
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.opacity = '1';
  t.style.transform = 'translate(-50%,-50%) scale(1)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%,-50%) scale(0.8)';
  }, 1800);
}

export function createModal(title, bodyHTML, onConfirm, onCancel, okLabel = 'OK') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      ${bodyHTML}
      <div class="btn-row">
        <button id="modal-cancel">Abbrechen</button>
        <button id="modal-ok">${okLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let done = false;
  const close = () => { if (done) return; done = true; document.body.removeChild(overlay); };
  overlay.querySelector('#modal-ok').onclick    = () => { if (!done) { onConfirm(); close(); } };
  overlay.querySelector('#modal-cancel').onclick = () => { if (!done) { if (onCancel) onCancel(); close(); } };
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); if (!done) { onConfirm(); close(); } }
    if (e.key === 'Escape') { e.preventDefault(); if (!done) { if (onCancel) onCancel(); close(); } }
  });
  overlay.focus();
  return overlay;
}

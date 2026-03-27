// =========================================================
// WELCOME ONBOARDING (geführte Ersteinrichtung)
// =========================================================
export function showWelcomeOnboarding() {
  const existing = document.getElementById('welcome-ob');
  if (existing) existing.remove();

  let step = 0;
  const STEPS = 4;

  const stepData = [
    // ── 1: Willkommen ────────────────────────────────────
    {
      icon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
      title: 'Willkommen!',
      subtitle: 'Miss Abstände, Flächen und mehr direkt in deinem Luftbild – einfach, ohne Vorkenntnisse.',
      content: () => `
        <div class="wob-steps">
          <div class="wob-step">
            <div class="wob-step-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
            <div class="wob-step-info">
              <span class="wob-step-label">1 · Bild laden</span>
              <span class="wob-step-desc">Drohnenfoto oder Luftbild hochladen</span>
            </div>
          </div>
          <div class="wob-step">
            <div class="wob-step-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M10 12h4"/></svg></div>
            <div class="wob-step-info">
              <span class="wob-step-label">2 · Maßstab setzen</span>
              <span class="wob-step-desc">Automatisch oder per Referenzlinie</span>
            </div>
          </div>
          <div class="wob-step">
            <div class="wob-step-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/></svg></div>
            <div class="wob-step-info">
              <span class="wob-step-label">3 · Messen</span>
              <span class="wob-step-desc">Distanz, Fläche, Kreis und mehr</span>
            </div>
          </div>
        </div>`,
      cta: 'Los geht\'s →',
      ctaStyle: '',
    },
    // ── 2: Bild laden ─────────────────────────────────────
    {
      icon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      title: 'Bild laden',
      subtitle: 'Lade ein Drohnenfoto oder ein Satellitenbild. Am besten mit der Kamera senkrecht nach unten.',
      content: () => `
        <div class="wob-tip">
          <b>DJI-Drohne?</b> Perfekt — Flughöhe und Kamera werden automatisch erkannt. Der Maßstab wird sofort berechnet.
        </div>
        <div class="wob-tip green" style="margin-top:8px;">
          <b>Kein Drohnenbild?</b> Auch okay — du kannst den Maßstab manuell über eine bekannte Strecke im Bild einstellen.
        </div>
        <div class="wob-tip" style="margin-top:8px;background:rgba(255,149,0,0.07);border-color:rgba(255,149,0,0.22);">
          <b>Tipp:</b> Je größer das Bild, desto genauer die Messungen. Beste Ergebnisse mit Nadir-Aufnahmen (Kamera 90° nach unten).
        </div>`,
      cta: 'Weiter →',
      ctaStyle: '',
    },
    // ── 3: Maßstab ────────────────────────────────────────
    {
      icon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M10 12h4"/></svg>',
      title: 'Maßstab setzen',
      subtitle: 'Damit Messungen stimmen, muss die App wissen, wie groß ein Pixel im Bild wirklich ist.',
      content: () => `
        <div class="wob-steps">
          <div class="wob-step">
            <div class="wob-step-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <div class="wob-step-info">
              <span class="wob-step-label">Automatisch (DJI &amp; Co.)</span>
              <span class="wob-step-desc">Kamera und Flughöhe werden aus dem Bild gelesen — du musst nichts tun.</span>
            </div>
          </div>
          <div class="wob-step">
            <div class="wob-step-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
            <div class="wob-step-info">
              <span class="wob-step-label">Referenzlinie zeichnen</span>
              <span class="wob-step-desc">Linie über eine bekannte Strecke ziehen und Länge eingeben — z.B. Hausseite 10 m, Weg 3 m.</span>
            </div>
          </div>
        </div>
        <div class="wob-tip" style="margin-top:10px;">
          Mehrere Referenzlinien erhöhen die Genauigkeit. Eine 10-m-Linie reicht für Messungen mit ±1–3 cm Genauigkeit.
        </div>`,
      cta: 'Weiter →',
      ctaStyle: '',
    },
    // ── 4: Messen ─────────────────────────────────────────
    {
      icon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/><line x1="14" y1="13" x2="11" y2="10"/></svg>',
      title: 'Messen',
      subtitle: 'Wähle in der Leiste oben ein Werkzeug — dann einfach auf das Bild klicken.',
      content: () => `
        <div class="wob-tools">
          <div class="wob-tool">
            <div class="wob-tool-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2 8V2h6l13.3 13.3z"/></svg></div>
            <div><div class="wob-tool-label">Distanz</div><div class="wob-tool-desc">2 Klicks → Länge</div></div>
          </div>
          <div class="wob-tool">
            <div class="wob-tool-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>
            <div><div class="wob-tool-label">Fläche</div><div class="wob-tool-desc">Klicken + Doppelklick</div></div>
          </div>
          <div class="wob-tool">
            <div class="wob-tool-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg></div>
            <div><div class="wob-tool-label">Kreis</div><div class="wob-tool-desc">Mitte → Rand</div></div>
          </div>
          <div class="wob-tool">
            <div class="wob-tool-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B3DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
            <div><div class="wob-tool-label">Label</div><div class="wob-tool-desc">Freier Text</div></div>
          </div>
        </div>
        <div class="wob-tip" style="margin-top:10px;">
          <b>Navigation:</b> Pinch oder Cmd+Scroll zum Zoomen · Scroll zum Verschieben · Doppelklick für 2× Zoom
        </div>`,
      cta: 'Bild laden →',
      ctaStyle: 'green',
    },
  ];

  const overlay = document.createElement('div');
  overlay.id = 'welcome-ob';
  overlay.className = 'wob-overlay';
  document.body.appendChild(overlay);

  const close = (markSeen = true) => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
    if (markSeen) localStorage.setItem('gp_ob_seen', '1');
  };

  const goTo = (i) => {
    step = Math.max(0, Math.min(STEPS - 1, i));
    render();
  };

  const render = () => {
    const sd = stepData[step];
    const isLast = step === STEPS - 1;
    const pct = ((step + 1) / STEPS * 100).toFixed(0);

    const dots = Array.from({ length: STEPS }, (_, i) =>
      `<div class="wob-dot ${i === step ? 'active' : ''}" data-i="${i}"></div>`
    ).join('');

    overlay.innerHTML = `
      <div class="wob-card" style="animation:wob-in 0.22s cubic-bezier(.4,0,.2,1);">
        <div class="wob-progress"><div class="wob-progress-bar" style="width:${pct}%"></div></div>
        <div class="wob-body">
          <div class="wob-icon">${sd.icon}</div>
          <div class="wob-title">${sd.title}</div>
          <div class="wob-subtitle">${sd.subtitle}</div>
          <div class="wob-content">${sd.content()}</div>
        </div>
        <div class="wob-foot">
          <div class="wob-dots">${dots}</div>
          <div class="wob-btn-row">
            ${step > 0 ? `<button class="wob-btn-secondary" id="wob-back">← Zurück</button>` : ''}
            <button class="wob-btn-primary ${sd.ctaStyle}" id="wob-next">${sd.cta}</button>
          </div>
          <button class="wob-btn-skip" id="wob-skip">Überspringen</button>
        </div>
      </div>`;

    // Dots navigation
    overlay.querySelectorAll('.wob-dot').forEach(dot => {
      dot.onclick = () => goTo(parseInt(dot.dataset.i));
    });

    // Back
    overlay.querySelector('#wob-back')?.addEventListener('click', () => goTo(step - 1));

    // Next / CTA
    overlay.querySelector('#wob-next').addEventListener('click', () => {
      if (isLast) {
        close();
        // Dateiauswahl öffnen — iOS braucht kurze Verzögerung nach DOM-Änderung
        setTimeout(() => document.getElementById('file-input').click(), 100);
      } else {
        goTo(step + 1);
      }
    });

    // Skip
    overlay.querySelector('#wob-skip').addEventListener('click', () => close());

    // Klick auf Overlay-Hintergrund schließt
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  };

  // Keyboard: Pfeiltasten + Escape
  const onKey = e => {
    if (!document.getElementById('welcome-ob')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); step < STEPS - 1 ? goTo(step + 1) : (close(), document.getElementById('file-input').click()); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(step - 1); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  document.addEventListener('keydown', onKey);

  render();
}

# Mobile Feld-Optimierung -- Design Spec

**Ziel:** Die App soll auf dem Smartphone im Feld praxistauglich zum Bemessen sein. Desktop-UX bleibt unangetastet.

**Kontext:** Foto + Referenzlinie werden am Desktop vorbereitet. Im Feld werden am Smartphone Leitungen eingezeichnet und bemessen. Alle Werkzeuge außer Bibliothek werden gebraucht. Hoch- und Querformat.

**Kernprobleme:**
- A) Finger verdeckt den Treffpunkt beim Tippen
- B) Buttons/Werkzeuge zu klein oder schlecht erreichbar
- C) Wechsel zwischen Zoom/Pan und Messen ist umständlich
- D) Maßzahlen und Linien auf kleinem Bildschirm schlecht lesbar

**Randbedingung:** Desktop-UX darf nicht leiden. Alle Änderungen greifen nur auf Touch-Geräten via `_isTouchDevice` / CSS `.touch-device`.

---

## 1. Fadenkreuz-Touch-System (Problem A)

### Aktuell
Tap auf Canvas setzt Punkt sofort an der Fingerposition. Finger verdeckt genau die Zielstelle.

### Neu (nur Touch-Geräte)
Touch-Down zeigt ein Fadenkreuz mit **80px vertikalem Offset** über dem Finger. Nutzer positioniert durch Ziehen, Loslassen setzt den Punkt am Fadenkreuz.

**Verhalten:**
- **Touch-Start:** Fadenkreuz erscheint 80px über Fingerspitze. Semitransparenter Kreis zeigt Fingerposition.
- **Touch-Move:** Fadenkreuz folgt 1:1 der Fingerbewegung (Offset bleibt konstant).
- **Touch-End (< 300ms, < 10px bewegt):** Schneller Tap -- Punkt direkt setzen (wie bisher). Für erfahrene Nutzer die schnell arbeiten.
- **Touch-End (> 300ms oder bewegt):** Punkt am Fadenkreuz setzen (Präzisions-Modus).
- **Zwei-Finger:** Zoom/Pan wie bisher, kein Fadenkreuz.

**Bildschirmrand-Behandlung:** Wenn der 80px-Offset nach oben das Fadenkreuz außerhalb des sichtbaren Viewports platzieren würde, wird der Offset nach unten gespiegelt (80px unter dem Finger). Analoges Verhalten wie die bestehende Lupe-Positionierung.

**Lupe:** Die bestehende `_loupe` wird an das Fadenkreuz gekoppelt. `_loupe.update()` erhält die Canvas-Koordinaten des Fadenkreuzes (Fingerposition + Offset), nicht die rohe Fingerposition. Positioniert sich automatisch so, dass sie nicht vom Finger verdeckt wird.

**Gilt für:** Alle Werkzeuge außer Select und Label. Label ist bewusst ausgenommen (Freitext-Platzierung braucht kein Präzisions-Fadenkreuz). Desktop unverändert.

---

## 2. Sticky-Touch-Toolbar (Problem B)

### Aktuell
Werkzeug-Buttons in horizontaler Toolbar oben. Auf Smartphone klein (36px) und mit Daumen schwer erreichbar.

### Neu (nur Touch-Geräte)
Zusätzliche Toolbar am unteren Bildschirmrand im Daumenbereich.

**Aufbau:**
- Feste Leiste am unteren Rand, halbtransparenter Hintergrund, `safe-area-inset-bottom` berücksichtigt
- **9 Buttons:** Auswahl, Referenz, Hilfslinie, Hilfspunkt, Distanz, Fläche, Kreis, Leitung, **Rückgängig**
- Arc und Label weggelassen (selten im Feld, über obere Toolbar erreichbar)
- **Button-Größe: 44x44px** (Touch-Target), horizontal scrollbar bei Platzmangel (Overflow: auto mit Snap-Scrolling). Bei typischen 360px-Displays passen 8 Buttons à 44px nebeneinander; der 9. ist per Scroll erreichbar.
- Aktives Werkzeug visuell hervorgehoben

**Synchronisation:**
- Auswahl, Referenz, Distanz, Fläche, Kreis, Leitung: Rufen `setTool()` auf, synchronisieren automatisch mit oberer Toolbar.
- **Hilfslinie und Hilfspunkt sind keine regulären Tools** -- sie toggeln `state.pipeRefMode` und haben eigene `onclick`-Handler (analog zu den bestehenden Buttons `btn-pipe-ref-line` / `btn-pipe-ref-point`). Ihre Active-State-Visualisierung ist unabhängig vom aktiven Tool, da sie parallel zu einem Tool aktiv sein können.
- **Rückgängig:** Ruft bestehende `undo()` Funktion auf. Kein Active-State nötig.

**Positionierung:**
- Über dem Drawer-Toggle-Button (der verschiebt sich leicht nach oben)
- Verschwindet wenn Drawer offen ist
- Querformat: kompaktere Variante, nur Icons

**Desktop:** `display: none` per Media Query / Touch-Detection.

---

## 3. Long-Press-Pan (Problem C)

### Aktuell
Ein-Finger im Select = Pan. Andere Tools = Messpunkt setzen. Für Zoom/Pan muss man zu "Auswahl" wechseln und zurück.

Zwei-Finger-Zoom/Pan funktioniert bereits und bleibt unverändert.

### Neu (nur Touch-Geräte)

**Gesten-State-Machine:**

```
Touch-Start (1 Finger)
  ├─ < 500ms, kaum Bewegung → Tap (Quick-Tap oder Crosshair je nach Dauer, siehe Abschnitt 1)
  ├─ < 500ms, Drag beginnt → CROSSHAIR-MODUS (committed, kein Pan mehr möglich für diese Geste)
  └─ ≥ 500ms, keine/kaum Bewegung → LONG-PRESS erkannt
       └─ Drag → PAN-MODUS (Vibration, Fadenkreuz verschwindet)
       └─ Loslassen ohne Drag → Kein Punkt, keine Aktion
```

Kernregel: **Sobald vor 500ms eine Drag-Bewegung (>10px) beginnt, wird zum Crosshair-/Werkzeug-Modus committed.** Long-Press-Pan ist dann für diese Geste nicht mehr erreichbar. Nur ein Halten ohne Bewegung über 500ms aktiviert Pan.

- **Ein-Finger = immer aktives Werkzeug** (kein Pan im Select-Modus)
- **Select-Modus auf Touch:** Fabric.js handhabt One-Finger-Interaktion nativ (Tap = Select, Drag auf Objekt = Move). Die bestehende Custom-Pan-Logik (Zeilen ~7537-7550) wird auf Touch-Geräten deaktiviert, stattdessen lässt man Fabric.js die Touch-Events direkt verarbeiten. Long-Press + Drag = Pan bleibt als einzige Pan-Möglichkeit neben Zwei-Finger.
- **Long-Press (>500ms ohne Bewegung) + Drag = Pan** in jedem Werkzeug
  - Kurze Vibration (Haptic API falls verfügbar) signalisiert Pan-Modus
  - Fadenkreuz verschwindet, Cursor zu Grabbing
  - Beim Loslassen wieder im Werkzeug
- **Zwei-Finger = Zoom + Pan** (wie bisher)

Eliminiert Toolwechsel komplett: Kurzer Touch/Drag = Messen, Langer Touch + Drag = Pan, Zwei Finger = Zoom+Pan.

**Desktop:** Unverändert. Alt+Drag und Leertaste+Drag für Pan bleiben.

---

## 4. Touch-Skalierung (Problem D)

### Aktuell
Maßzahlen, Linienstärken und Labels für Desktop optimiert. Auf Smartphone bei Sonnenlicht schwer lesbar.

### Neu (nur Touch-Geräte)
Globale Konstante steuert Skalierung:
```javascript
const TOUCH_SCALE = _isTouchDevice ? 1.5 : 1.0;
```

**Skalierte Elemente:**
- Maßzahlen (Distanz, Fläche, Kreis, Bemaßungslinien): 12-14px -> **18px**, bold
- Halo/Outline hinter Maßzahlen: 2px -> **4px**
- Bemaßungslinien: 1px -> **2px** Linienstärke
- Bemaßungs-Endpunkte (Dots): 5px -> **8px** Radius
- Referenzlinien-Labels: gleiche Skalierung
- Zoom-HUD und Status-Anzeige: **16px**, höherer Kontrast

**Desktop:** `TOUCH_SCALE = 1.0`, keine Änderung.

---

## Architektur-Übersicht

| Komponente | Problem | Touch-Gerät | Desktop |
|---|---|---|---|
| Fadenkreuz-System | Finger verdeckt Ziel | Offset-Cursor + Lupe | Unverändert |
| Sticky-Touch-Toolbar | Buttons zu klein/fern | 48px Leiste unten + Undo | Unsichtbar |
| Long-Press-Pan | Toolwechsel nötig | State-Machine: Drag=Tool, Hold=Pan | Unverändert (Alt/Space) |
| Touch-Skalierung | Schlechte Lesbarkeit | 1.5x Faktor | Unverändert (1.0x) |

**Dateien:** Keine neuen Dateien. Alles in `index-1.html`.

**Änderungen:**
- Neuer CSS-Block für `.touch-device`-spezifische Styles (~50 Zeilen)
- Fadenkreuz-Logik + Long-Press-Pan ersetzt bestehenden Touch-Event-Block (Zeilen ~7485-7579)
- Neue Touch-Toolbar im HTML + JS für Synchronisation (inkl. separate Hilfslinie/Hilfspunkt-Handler)
- Select-Modus: Custom-Pan auf Touch deaktivieren, Fabric.js native Touch-Verarbeitung nutzen
- `TOUCH_SCALE` Konstante + Anpassung der Render-Funktionen

**Speicherformat:** Keine Änderung. Visuelle Anpassungen sind rein zur Laufzeit, Projekte bleiben kompatibel.

**Iterativ:** Weitere Optimierungen (z.B. Arc-Tool mobil, Label mobil, Haptic Feedback für andere Events, Offline-PWA) können in späteren Iterationen folgen.

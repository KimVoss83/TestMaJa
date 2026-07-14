# Wohnfläche — Indoor-Grundriss-Messapp (Design)

**Datum:** 2026-07-14
**Status:** Vom Nutzer freigegeben (Abschnitte 1–4 einzeln bestätigt)

## Ziel

Neue eigenständige Web-App zum Messen in Wohnungsgrundrissen mit
WoFlV-konformer Wohnflächenberechnung plus freiem Messen (Distanz, Fläche,
Kreis). UI und Technik-Stack wie die bestehende Luftbild-App (`planer/`),
Kern-Module werden per Copy & Strip nachgenutzt (Ansatz A, s.u.).

**Anforderungen (geklärt):**

- Hauptzweck: Wohnflächenberechnung mit voller WoFlV-Konformität, plus freies
  Messen im Grundriss
- Input: PDF (Exposé/Architekt), Foto/Scan vom Papierplan, Bilddatei (PNG/JPG)
- Export: PDF-Bericht mit Raumliste, CSV, Plan-Export (PDF/PNG), Projekt-JSON
- Ein Plan pro Projekt (Maisonette = zwei Projekte; Mehretagen ist Phase 2)
- Reine Client-App, Deployment über GitHub Pages wie bisher

## Entscheidung: Ansatz A — Copy & Strip

Betrachtete Alternativen:

- **A) Eigenständige App im selben Repo per Copy & Strip** ← gewählt
- B) Gemeinsames Core-Paket: sauber, erfordert aber vorab großen Refactor der
  DOM-Kopplungen (`getElementById` auf feste IDs überall) und fasst die
  stabile Live-App an
- C) Indoor-Modus in `planer/`: UI überladen, verzweigte State-Logik —
  verworfen

Begründung für A: Kern ist stabil und getestet; Kopie kostet wenig, erlaubt
aggressives Entschlacken (~3.300 Zeilen Outdoor-Code entfallen) und hat kein
Regressionsrisiko für die Live-App. Migration zu B bleibt später möglich.
Bekannter Trade-off: Bugfixes in Kern-Modulen müssen ggf. doppelt gepflegt
werden.

## Architektur & Struktur

Neues Vite-Projekt `wohnflaeche/` neben `planer/`, gleiche Toolchain
(Vite + `vite-plugin-singlefile`), Build-Ausgabe wird als `wohnflaeche.html`
im Repo-Root ausgeliefert (Muster wie `feldaufnahme.html`).

```
wohnflaeche/
├── index.html          Kopie von planer, entschlackt (Leitungs-UI raus, Raum-UI rein)
├── src/
│   ├── main.js         Verdrahtung (angepasste Kopie)
│   ├── state.js        + rooms[], − pipes/pipeRefs
│   ├── canvas.js       unverändert übernommen
│   ├── undo.js         unverändert
│   ├── tools/          ref, distance, area, circle, arc, label, select, tool-manager (übernommen)
│   │   ├── room.js     NEU: Raum-Polygon-Werkzeug (90°-Snap default)
│   │   └── zone.js     NEU: Höhenzonen (Dachschrägen) & Abzugsflächen
│   ├── woflv/
│   │   └── calc.js     NEU: WoFlV-Rechenlogik als pure functions (kein DOM/Canvas)
│   ├── ui/             grid, statusbar, modals übernommen; sidebar angepasst
│   │   └── raumliste.js NEU: Raumliste + Summen
│   ├── io/
│   │   ├── save-load.js    angepasst (rooms statt pipes, version-Feld)
│   │   ├── image-loader.js übernommen, − EXIF-Teil
│   │   ├── pdf-import.js   NEU: PDF.js-Rendering (Basis aus feldaufnahme.html)
│   │   ├── report.js       NEU: PDF-Bericht + CSV-Export
│   │   └── library.js      übernommen (Möbel-SVGs = Phase 2)
│   ├── utils/          helpers, loupe unverändert
│   └── mobile/         touch, drawer unverändert
└── tests/              WoFlV-Unit-Tests + E2E (Muster aus planer/tests)
```

**Nicht übernommen:** `pipe-*`-Module, `materialrechner`, `photogrammetry`,
`ref-onboarding` (ersetzt durch Grundriss-Onboarding).
Netto: ~5.100 Zeilen Basis übernommen, geschätzt ~1.500–2.000 Zeilen neu.

## Datenmodell

Zentrales Objekt in `state.rooms[]`:

```js
{
  id, name: 'Wohnzimmer',
  kind: 'wohnflaeche' | 'zubehoer',   // Zubehör zählt 0, wird als Nutzfläche gelistet
  category: 'normal' | 'wintergarten-unbeh' | 'schwimmbad'
          | 'balkon' | 'loggia' | 'terrasse' | 'dachgarten',
  balkonFaktor: 0.25,                 // nur Balkon-artige Kategorien, editierbar 0.25–0.5
  polygon: [{x,y}, …],                // Canvas-Pixel; m² live über state.scale
  zones: [                            // Höhenzonen, nur wo Höhe < 2 m
    { polygon: […], height: '1bis2m' },   // zählt 50 %
    { polygon: […], height: 'unter1m' },  // zählt 0 %
  ],
  deductions: [                       // §3(3): Pfeiler, Schornsteine, Treppen > 3 Steigungen
    { polygon: […], label: 'Kamin' },
  ],
}
```

## WoFlV-Rechenlogik (`woflv/calc.js`)

Pure functions — Eingabe Pixel-Polygone + `scale`, Ausgabe m²:

```
Rohfläche       = Shoelace(polygon) / scale²        (Shoelace existiert in area.js)
Basisfläche     = Rohfläche − Σ Abzüge
Höhenanrechnung = (Basis − zone50 − zone0) · 1.0 + zone50 · 0.5 + zone0 · 0
Anrechenbar     = Höhenanrechnung × Kategoriefaktor
                  (normal 1.0 · Wintergarten/Schwimmbad 0.5 · Balkon balkonFaktor)

Wohnfläche gesamt          = Σ Anrechenbar aller kind='wohnflaeche'
Nutzfläche (nachrichtlich) = Σ Rohflächen aller kind='zubehoer'
```

**Validierungen** (Hinweise, keine Blocker):

- Abzug ≤ 0,1 m² → Warnung „zählt nach §3(3) nicht als Abzug“, wird in der
  Summe ignoriert
- Höhenzone ragt über Raumgrenze → am Raum-Polygon geclippt
- Balkonfaktor auf 0,25–0,5 begrenzt (WoFlV: „i.d.R. ¼, höchstens ½“)
- Ausgaben auf 2 Nachkommastellen; Summen aus ungerundeten Werten (kein
  Rundungsdrift)

**Bewusst außen vor** (im 2D-Plan nicht ermittelbar): Putzabzug (§3(4) —
lichte Maße werden ohnehin aus dem Plan gemessen), Tür-/Fensternischen-
Sonderfälle (Nutzer zeichnet das Polygon entsprechend).

## UI & Workflow

Layout wie `planer/`: Werkzeugleiste oben, Canvas mittig, Sidebar rechts
(Akkordeons), Statusbar unten, Mobile-Drawer + Touch-Gesten unverändert.

**Werkzeuge:**

| Werkzeug | Verhalten |
|----------|-----------|
| Auswahl | wie bisher |
| Maßstab | Referenzlinie wie bisher, plus PDF-Weg (s. Kalibrierung) |
| Raum (NEU) | Polygon klicken, Doppelklick schließt → Modal: Name, Art, Kategorie. 90°-Snap default an (Shift = frei) |
| Zone (NEU) | in Raum klicken → Höhenzonen-Polygon (1–2 m oder < 1 m), am Raum geclippt, schraffiert |
| Abzug (NEU) | wie Zone, für Pfeiler/Kamin/Treppe — rot schraffiert |
| Distanz / Fläche / Kreis / Label | 1:1 übernommen |

**Canvas-Darstellung:** Räume halbtransparent gefüllt (Farbe je Kategorie),
Label mit Raumname + anrechenbaren m² in Polygon-Mitte, Live-Update beim
Handle-Editing (Mechanik vom Flächen-Werkzeug).

**Raumliste (Sidebar-Akkordeon, ersetzt Leitungen):** eine Zeile pro Raum
(Name · Rohfläche · Faktor/Zonen · anrechenbar), Klick fokussiert den Raum,
Umbenennen/Kategorie/Löschen pro Zeile. Sticky-Fußzeile mit Wohnfläche gesamt
und Nutzfläche (nachrichtlich).

**Kalibrierungs-Onboarding** (ersetzt Drohnen-EXIF-Flow):

- PDF geladen → Karte: „Aufgedruckter Maßstab?“ (1:50 / 1:75 / 1:100 / frei)
  → exakte Kalibrierung aus PDF-Seitengröße (pt → Papier-cm → Meter).
  Alternative und empfohlene Kontrolle: Referenzlinie über eine
  Bemaßungskette, da Exposé-PDFs oft skaliert gedruckt sind
- Bild/Foto geladen → direkt „Referenzlinie über bekanntes Maß zeichnen“
- Gating wie bisher: Mess-/Raum-Werkzeuge erst nach Maßstab aktiv
  (`needs-ref`-Mechanik übernommen)

## Import

- Drop-Zone & File-Input akzeptieren zusätzlich `.pdf` → PDF.js rendert die
  Seite (~150-DPI-Äquivalent) auf Offscreen-Canvas → weiter wie Bild.
  Mehrseitige PDFs: Seitenwähler mit Thumbnails
- PDF.js per CDN mit SRI-Hash (Sicherheitsniveau halten)
- Seitengröße in pt wird gespeichert → Grundlage der 1:X-Kalibrierung

## Export (`io/report.js`)

- **PDF-Bericht** (jsPDF): Seite 1 = Plan mit Räumen/Zonen, Seite 2 = Tabelle
  (Raum · Rohfläche · Abzüge · Zonen-Anteile · Faktor · anrechenbar) + Summen
  + Fußnote „Berechnung in Anlehnung an WoFlV, Angaben ohne Gewähr“ +
  Datum/Maßstabsquelle
- **CSV:** gleiche Tabelle, Semikolon-getrennt, deutsche Dezimal-Kommas
- **Plan-PNG/PDF, Projekt-JSON:** 1:1 übernommen; JSON-Schema um `rooms` und
  `version`-Feld erweitert

## Fehlerbehandlung & Sicherheit

- Werte aus geladenen Dateien (insb. Raumnamen aus Projekt-JSON) vor
  `innerHTML` durch `escHtml()`; bestehender XSS-Test wird für Raumnamen
  dupliziert
- Selbstüberschneidende Polygone → Warnung, Fläche via Shoelace-Betrag
- Defektes/geschütztes PDF → Toast, App bleibt bedienbar
- `_safeHandler`-Wrapper für Canvas-Events übernommen

## Tests (Playwright, Muster `planer/tests/`)

1. **WoFlV-Unit-Tests** gegen `woflv/calc.js` via `page.evaluate`-Import:
   Rohfläche, Abzüge, 50-%-Zone, Balkonfaktor, Zubehör = 0,
   0,1-m²-Abzugsregel, Rundung
2. **E2E:** PDF laden → 1:100 kalibrieren → Raum zeichnen → Fläche in
   Raumliste korrekt (bekannte Geometrie, Toleranz ±1 %)
3. **Export:** PDF-Bericht beginnt mit `%PDF-`, CSV enthält Summenzeile
4. **XSS:** bösartiger Raumname aus Projekt-JSON wird inert gerendert

## Phase 2 (bewusst nicht im ersten Wurf)

Möbel-Bibliothek (library.js mit Indoor-SVGs), mehrere Etagen pro Projekt,
automatische Wanderkennung.

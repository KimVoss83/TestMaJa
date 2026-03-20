# Canva-Style UI Redesign — Gartenplaner

## Ziel

Komplettes UI-Redesign der Gartenplaner-App im Canva Look & Feel. Hybrid-Ansatz: bestehende Struktur beibehalten, aber mit Canva-Farbschema, Icons und aufgeräumtem Layout. Fokus auf **Icons** und **Übersichtlichkeit**.

## Scope

- CSS komplett überarbeiten
- HTML-Struktur anpassen (Toolbar-Buttons mit Icons, Sidebar Tabs statt Akkordeon)
- JavaScript-Logik bleibt unverändert (nur minimale DOM-Anpassungen für neue Struktur)

## Design-Entscheidungen

### Farbschema

| Element | Alt | Neu |
|---------|-----|-----|
| Header BG | `#ffffff` | `#252627` (Canva dark) |
| Header Text | `#2d2d2d` | `#ffffff` |
| Akzentfarbe | `#2d2d2d` | `#8B3DFF` (Canva-Lila) |
| Aktiver Button BG | `#2d2d2d` | `#f0ebff` (light purple) |
| Aktiver Button Text | `#fff` | `#7B2FBE` |
| Toolbar BG | `#ffffff` | `#ffffff` (bleibt) |
| Sidebar BG | `#f8f9fa` | `#ffffff` |
| Canvas BG | `#dde1e7` | `#f0f0f0` |
| Primary Action | `#2d2d2d` | `#8B3DFF` |

### 1. Header (Canva-Dark)

- Hintergrund `#252627` mit weißer Schrift
- Logo-Icon + "Planer" links
- Rechts: Icon-Buttons (Speichern, Laden, PDF, PNG, Undo/Redo, Bug, Neu, Hilfe)
- Buttons: `rgba(255,255,255,0.08)` Background, hover `0.14`
- Alle Icons als Inline-SVG (Feather-Icons-Stil, stroke-width 2)
- Höhe: 52px (statt 44px) für bessere Touch-Targets

### 2. Toolbar (Weiß, mit Icons)

- Zeile 1 (Datei-Operationen) → in Header verschoben
- Zeile 2 (Werkzeuge): Jeder Button bekommt SVG-Icon + Text
  - Auswahl: Cursor-Icon
  - Label: Stift-Icon
  - Maßstab: Lineal-Icon
  - Distanz: Measure-Icon
  - Fläche: Quadrat-Icon
  - Kreis: Circle-Icon
  - Kreisabschnitt: Arc-Icon
  - Leitung: Pipe-Icon
  - Hilfslinie/Hilfspunkt: Guide-Icons
- Aktiver Button: `background: #f0ebff; color: #7B2FBE;`
- Zeile 3 (Formatierung): Farbe, Schrift, Linie — bleiben, aber mit mehr Spacing
- Pipe-Type-Gruppe: erscheint weiterhin nur bei aktivem Leitungs-Tool

### 3. Sidebar (Tab-basiert)

**Tabs statt Akkordeon:**
- 4 Tabs oben: Maßstab, Messungen, Leitungen, Bibliothek
- Jeder Tab: SVG-Icon + Label darunter
- Aktiver Tab: Lila Unterstrich `#8B3DFF` + lila Text
- Content scrollt unter den fixen Tabs

**Messungsliste:**
- Jedes Item: Icon-Badge (farbig, Typ-abhängig) + Label + Wert
- Aktionen (Kopieren, Löschen) nur bei Hover sichtbar
- Icon-Badge: `background: #f0ebff` mit lila Icon

**Bibliothek:**
- Kategorie-Chips bleiben (Farbe → Lila wenn aktiv)
- 3er-Grid bleibt
- Items: hover mit lila Border statt dunkelgrau

**Leitungen:**
- Pipe-Groups bleiben strukturell gleich
- Toggle-Button: Lila statt Dunkelgrau

**Eigene Bibliothek:**
- Buttons: Lila-Akzent statt Dunkelgrau

### 4. Modals & Popovers

- Primary-Button (`#modal-ok`): `#8B3DFF` statt `#2d2d2d`
- Border-Radius: 14px (statt 12px)
- Blur: bleibt

### 5. Onboarding

- Progress-Bar: `#8B3DFF` statt `#2d2d2d`
- Primary-Buttons: `#8B3DFF`
- Dot active: `#8B3DFF`

### 6. Statusbar

- Bleibt minimal, nur Farbkonsistenz sicherstellen

### 7. Zoom HUD

- Bleibt, passt bereits zum Design

## SVG-Icons

Alle Icons werden als Inline-SVG eingebettet (kein Icon-Font, keine externe Dependency). Stil: Feather Icons (24x24 viewBox, stroke-width 2, no fill, currentColor).

Benötigte Icons:
- **Header:** Save, FileText (PDF), Image (PNG), Upload, Download, RotateCcw (Undo), RotateCw (Redo), AlertCircle (Bug), Bell (Neu), HelpCircle
- **Toolbar:** MousePointer (Auswahl), Type (Label), Ruler (Maßstab), Maximize2 (Distanz), Square (Fläche), Circle, Arc, GitBranch (Leitung), Plus (Hilfslinie/punkt)
- **Sidebar Tabs:** Ruler, List, GitBranch, Grid

## Nicht im Scope

- JavaScript-Logik / Canvas-Rendering
- Neue Features
- Responsive Breakpoints (bleiben)
- Fabric.js Interaktionen

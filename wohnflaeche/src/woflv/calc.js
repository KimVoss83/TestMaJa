// =========================================================
// WoFlV-Rechenlogik — pure functions, kein DOM, kein Canvas.
// Polygone in Canvas-px; scale = px pro Meter → Ergebnisse in m².
// =========================================================
export const BALKON_KATEGORIEN = ['balkon', 'loggia', 'terrasse', 'dachgarten'];
export const KATEGORIE_FAKTOR = { 'normal': 1.0, 'wintergarten-unbeh': 0.5, 'schwimmbad': 0.5 };
export const MIN_ABZUG_M2 = 0.1;   // §3(3): kleinere Abzüge zählen nicht

export function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Fläche von A ∩ B per Rastersampling über die BBox von A.
// Exakte Fläche von A × Trefferquote → Fehler < ~0,5 % bei 300er-Raster.
export function intersectionArea(polyA, polyB) {
  const xs = polyA.map(p => p.x), ys = polyA.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const stepX = (maxX - minX) / 300, stepY = (maxY - minY) / 300;
  if (!(stepX > 0) || !(stepY > 0)) return 0;
  let hits = 0, total = 0;
  for (let x = minX + stepX / 2; x < maxX; x += stepX)
    for (let y = minY + stepY / 2; y < maxY; y += stepY) {
      const p = { x, y };
      if (pointInPolygon(p, polyA)) { total++; if (pointInPolygon(p, polyB)) hits++; }
    }
  return total === 0 ? 0 : shoelace(polyA) * (hits / total);
}

export function roomCalc(room, scale) {
  const px2m2 = v => v / (scale * scale);
  const roh = px2m2(shoelace(room.polygon));

  const abzuege = (room.deductions || []).map(d =>
    ({ ...d, area_m2: px2m2(intersectionArea(d.polygon, room.polygon)) }));
  const counted = abzuege.filter(d => d.area_m2 > MIN_ABZUG_M2);
  const abzugSum = counted.reduce((s, d) => s + d.area_m2, 0);
  const basis = Math.max(0, roh - abzugSum);

  let zone50 = 0, zone0 = 0;
  for (const z of room.zones || []) {
    let a = px2m2(intersectionArea(z.polygon, room.polygon));
    for (const d of counted) a -= px2m2(intersectionArea(z.polygon, d.polygon));
    a = Math.max(0, a);
    if (z.height === '1bis2m') zone50 += a; else zone0 += a;
  }
  zone50 = Math.min(zone50, basis);
  zone0  = Math.min(zone0, Math.max(0, basis - zone50));

  const hoehen = (basis - zone50 - zone0) + 0.5 * zone50;
  const faktor = BALKON_KATEGORIEN.includes(room.category)
    ? Math.min(0.5, Math.max(0.25, room.balkonFaktor ?? 0.25))
    : (KATEGORIE_FAKTOR[room.category] ?? 1);
  const anrechenbar = room.kind === 'zubehoer' ? 0 : hoehen * faktor;
  return { roh, abzugSum, zone50, zone0, faktor, anrechenbar, abzuege };
}

export function totals(rooms, scale) {
  let wohnflaeche = 0, nutzflaeche = 0;
  const perRoom = (rooms || []).map(r => {
    const c = roomCalc(r, scale);
    if (r.kind === 'zubehoer') nutzflaeche += c.roh; else wohnflaeche += c.anrechenbar;
    return { room: r, calc: c };
  });
  return { perRoom, wohnflaeche, nutzflaeche };
}

// PDF-Kalibrierung: Papierbreite (pt) + aufgedruckter Maßstab 1:X → px/m
export function scaleFromPrintScale(ratioX, pageWidthPt, renderedWidthPx) {
  const paperWidth_m = pageWidthPt / 72 * 0.0254;
  return renderedWidthPx / (paperWidth_m * ratioX);
}

export const fmt2 = v =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

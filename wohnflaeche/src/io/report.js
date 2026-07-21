import { state } from '../state.js';
import { canvas } from '../canvas.js';
import { totals, fmt2 } from '../woflv/calc.js';

export function buildCSV(rooms, scale) {
  const t = totals(rooms, scale);
  const esc = c => `"${String(c ?? '').replace(/"/g, '""')}"`;
  const rows = [['Raum', 'Art', 'Kategorie', 'Rohfläche m²', 'Abzüge m²',
                 'Zone 50% m²', 'Zone 0% m²', 'Faktor', 'Anrechenbar m²']];
  for (const { room, calc } of t.perRoom)
    rows.push([room.name, room.kind, room.category, fmt2(calc.roh), fmt2(calc.abzugSum),
               fmt2(calc.zone50), fmt2(calc.zone0),
               room.kind === 'zubehoer' ? '—' : String(calc.faktor).replace('.', ','),
               fmt2(calc.anrechenbar)]);
  rows.push([]);
  rows.push(['Wohnfläche gesamt', '', '', '', '', '', '', '', fmt2(t.wohnflaeche)]);
  rows.push(['Nutzfläche (nachrichtlich)', '', '', '', '', '', '', '', fmt2(t.nutzflaeche)]);
  return rows.map(r => r.map(esc).join(';')).join('\r\n');
}

export function exportCSV() {
  const blob = new Blob(['﻿' + buildCSV(state.rooms, state.scale)],  // BOM für Excel-Umlaute
    { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wohnflaeche.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportReportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // ── Seite 1: Plan ──
  const png = canvas.toDataURL({ format: 'png', multiplier: 2 });
  const iw = canvas.width, ih = canvas.height;
  const maxW = 277, maxH = 180;
  const f = Math.min(maxW / iw, maxH / ih);
  doc.setFontSize(14); doc.text('Wohnflächenberechnung — Plan', 10, 12);
  doc.addImage(png, 'PNG', 10, 18, iw * f, ih * f);
  // ── Seite 2: Tabelle ──
  doc.addPage('a4', 'portrait');
  const t = totals(state.rooms, state.scale);
  doc.setFontSize(14); doc.text('Wohnflächenberechnung — Raumliste', 14, 16);
  doc.setFontSize(9);
  const cols = [14, 64, 94, 118, 140, 158, 176];
  const head = ['Raum', 'Kategorie', 'Rohfl. m²', 'Abzüge', 'Zonen 50/0', 'Faktor', 'Anrechenbar'];
  let y = 26;
  doc.setFont(undefined, 'bold');
  head.forEach((h, i) => doc.text(h, cols[i], y));
  doc.setFont(undefined, 'normal');
  y += 3; doc.line(14, y, 196, y); y += 5;
  for (const { room, calc } of t.perRoom) {
    doc.text(String(room.name).slice(0, 28) + (room.kind === 'zubehoer' ? ' (Zubehör)' : ''), cols[0], y);
    doc.text(room.category, cols[1], y);
    doc.text(fmt2(calc.roh), cols[2], y, { align: 'left' });
    doc.text(fmt2(calc.abzugSum), cols[3], y);
    doc.text(`${fmt2(calc.zone50)}/${fmt2(calc.zone0)}`, cols[4], y);
    doc.text(room.kind === 'zubehoer' ? '—' : String(calc.faktor).replace('.', ','), cols[5], y);
    doc.text(fmt2(calc.anrechenbar), cols[6], y);
    y += 6;
    if (y > 270) { doc.addPage('a4', 'portrait'); y = 20; }
  }
  y += 2; doc.line(14, y, 196, y); y += 6;
  doc.setFont(undefined, 'bold');
  doc.text('Wohnfläche gesamt', cols[0], y); doc.text(fmt2(t.wohnflaeche) + ' m²', cols[6], y); y += 6;
  doc.setFont(undefined, 'normal');
  doc.text('Nutzfläche (nachrichtlich)', cols[0], y); doc.text(fmt2(t.nutzflaeche) + ' m²', cols[6], y);
  y += 12;
  doc.setFontSize(7.5); doc.setTextColor(120);
  const quelle = state.scaleSource === 'pdf'
    ? `Maßstab 1:${state.printScale} (aus PDF-Seitengröße)` : 'Maßstab aus Referenzlinie(n)';
  doc.text(`Berechnung in Anlehnung an die Wohnflächenverordnung (WoFlV). Angaben ohne Gewähr.`, 14, y);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} · ${quelle}`, 14, y + 4);
  doc.save('wohnflaechenbericht.pdf');
}

window.exportReportPDF = exportReportPDF;
window.exportCSV = exportCSV;

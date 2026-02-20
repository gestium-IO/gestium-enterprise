// ═══════════════════════════════════════════════════════
//  GESTIUM · pdf.js
//  Generador de Reporte Mensual PDF
//  Usa jsPDF cargado desde CDN en app.html (window.jspdf)
// ═══════════════════════════════════════════════════════

import { clp, fmtShort } from './utils.js';

/* ── GENERAR REPORTE MENSUAL PDF ── */
export async function generarReporte(empresaData, usuarioData, logoB64, mesStr, cotizaciones) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pw = doc.internal.pageSize.getWidth();
  const TEAL   = [6, 214, 200];
  const NAVY   = [7, 13, 26];
  const NAVY2  = [13, 22, 41];
  const WHITE  = [255, 255, 255];
  const GRAY   = [148, 163, 184];
  const RED    = [239, 68, 68];
  const GREEN  = [34, 197, 94];

  const [anio, mes] = mesStr.split("-");
  const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1)
    .toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  // ── HEADER ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 42, "F");

  // Logo si existe
  if (logoB64) {
    try {
      doc.addImage(logoB64, "PNG", 12, 8, 24, 24);
    } catch (e) { /* ignorar si el logo falla */ }
  }

  // Nombre empresa
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text(empresaData?.nombre || "GESTIUM", logoB64 ? 42 : 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("REPORTE MENSUAL DE VENTAS", logoB64 ? 42 : 14, 27);

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Período: ${nombreMes.toUpperCase()}`, logoB64 ? 42 : 14, 34);

  // Fecha de generación (esquina derecha)
  doc.setFontSize(7);
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, pw - 14, 16, { align: "right" });
  doc.text(`Usuario: ${usuarioData?.nombre || "—"}`, pw - 14, 22, { align: "right" });

  // Línea separadora teal
  doc.setFillColor(...TEAL);
  doc.rect(0, 42, pw, 1.5, "F");

  // ── KPIs RESUMEN ──
  const totalVentas = cotizaciones.reduce((s, c) => s + (c.total || 0), 0);
  const totalIva    = cotizaciones.reduce((s, c) => s + (c.iva || 0), 0);
  const totalSub    = cotizaciones.reduce((s, c) => s + (c.subtotal || 0), 0);
  const cantVentas  = cotizaciones.length;
  const promedioVenta = cantVentas > 0 ? totalVentas / cantVentas : 0;

  const kpis = [
    { label: "Total Ventas",     valor: clp(totalVentas),    color: GREEN },
    { label: "Subtotal (sin IVA)", valor: clp(totalSub),     color: WHITE },
    { label: "IVA Generado",     valor: clp(totalIva),       color: WHITE },
    { label: "Nº de Ventas",     valor: String(cantVentas),  color: TEAL  },
    { label: "Promedio/Venta",   valor: clp(promedioVenta),  color: GRAY  },
  ];

  let kpiX = 12;
  const kpiY = 50;
  const kpiW = (pw - 24) / kpis.length;

  kpis.forEach(k => {
    doc.setFillColor(...NAVY2);
    doc.roundedRect(kpiX, kpiY, kpiW - 3, 22, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(k.label, kpiX + (kpiW - 3) / 2, kpiY + 7, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...k.color);
    doc.text(k.valor, kpiX + (kpiW - 3) / 2, kpiY + 16, { align: "center" });
    kpiX += kpiW;
  });

  // ── TABLA DE VENTAS ──
  const startY = kpiY + 30;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text("DETALLE DE VENTAS CONFIRMADAS", 14, startY);

  // Cabecera tabla
  const cols = ["#", "Fecha", "Cliente", "Nº Cot.", "Subtotal", "IVA", "Total"];
  const colW  = [8, 22, 60, 18, 25, 22, 25];
  let tableX  = 12;
  let tableY  = startY + 5;

  doc.setFillColor(...NAVY2);
  doc.rect(12, tableY, pw - 24, 8, "F");

  let cx = tableX;
  cols.forEach((col, i) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEAL);
    doc.text(col, cx + colW[i] / 2, tableY + 5.5, { align: "center" });
    cx += colW[i];
  });

  tableY += 8;

  cotizaciones.forEach((c, idx) => {
    // Nueva página si se necesita
    if (tableY > 265) {
      doc.addPage();
      tableY = 20;
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pw, 14, "F");
      doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text(`${empresaData?.nombre || "GESTIUM"} · Reporte ${nombreMes} · Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pw / 2, 9, { align: "center" });
    }

    const rowColor = idx % 2 === 0 ? [10, 18, 35] : [13, 22, 41];
    doc.setFillColor(...rowColor);
    doc.rect(12, tableY, pw - 24, 7, "F");

    const fecha = c.fecha?.toDate?.() ?? new Date();
    const vals  = [
      String(idx + 1),
      fmtShort(fecha),
      (c.cliente || "—").slice(0, 28),
      String(c.numero || "—"),
      clp(c.subtotal || 0),
      clp(c.iva || 0),
      clp(c.total || 0),
    ];

    cx = tableX;
    vals.forEach((v, i) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...(i === 6 ? WHITE : GRAY));
      doc.text(v, cx + colW[i] / 2, tableY + 4.8, { align: "center" });
      cx += colW[i];
    });

    tableY += 7;
  });

  // Fila de totales
  doc.setFillColor(...NAVY);
  doc.rect(12, tableY + 2, pw - 24, 9, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text("TOTAL PERÍODO", 14, tableY + 8);
  doc.setTextColor(...GREEN);
  doc.text(clp(totalVentas), pw - 14, tableY + 8, { align: "right" });

  // ── FOOTER ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, doc.internal.pageSize.getHeight() - 12, pw, 12, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `GESTIUM · Inteligencia Operativa · gestium.inteligencia@gmail.com · WA: +57 300 554 1411`,
      pw / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
    doc.text(`Pág. ${i} / ${totalPages}`, pw - 14, doc.internal.pageSize.getHeight() - 5, { align: "right" });
  }

  // ── DESCARGAR ──
  const nombreArchivo = `GESTIUM_Reporte_${anio}-${mes}_${(empresaData?.nombre || "empresa").replace(/\s+/g, "_")}.pdf`;
  doc.save(nombreArchivo);
}

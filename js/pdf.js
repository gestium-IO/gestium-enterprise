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

// ── GENERAR PDF DE COTIZACIÓN INDIVIDUAL ──────────────────────────
// Llamado desde cotizaciones.js con los datos de la cotización
export function generarPDF(empresaData, usuarioData, logoB64, filas, { num, cliente, subtotal, ivaT, ivaP, total }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // ── Watermark
  function addWatermark() {
    const ph = doc.internal.pageSize.getHeight();
    try {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.04 }));
      doc.setFont("helvetica","bold"); doc.setFontSize(48);
      doc.setTextColor(6,214,200);
      doc.text("GESTIUM", pw/2, ph/2, { align:"center", angle:45 });
      doc.restoreGraphicsState();
    } catch(e){}
    doc.setFontSize(7); doc.setTextColor(150,150,150);
    doc.setFont("helvetica","normal");
    doc.text("GESTIUM · Inteligencia Operativa · WA: +57 300 554 1411 · gestium.inteligencia@gmail.com", pw/2, ph-10, { align:"center" });
  }

  // ── Header GESTIUM
  const H = 96;
  const emp = empresaData || {};
  doc.setFillColor(7,13,26); doc.rect(0,0,pw,H,"F");
  doc.setFillColor(6,214,200); doc.rect(0,0,pw,3,"F");
  doc.setFillColor(249,115,22); doc.rect(0,H-3,pw,3,"F");

  if (logoB64) {
    try {
      const t = logoB64.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(logoB64, t, 34, 12, 80, 44);
    } catch(e){}
  }

  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold"); doc.setFontSize(16);
  doc.text(emp.nombre||"Mi Empresa", pw-34, 26, { align:"right" });
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  let yd = 38;
  if (emp.nit)     { doc.text("NIT: "+emp.nit, pw-34, yd, {align:"right"}); yd+=10; }
  const dir = [emp.direccion, emp.ciudad, emp.pais].filter(Boolean).join(", ");
  if (dir)         { doc.text(dir, pw-34, yd, {align:"right"}); yd+=10; }
  if (emp.telefono){ doc.text("Tel: "+emp.telefono, pw-34, yd, {align:"right"}); yd+=10; }
  if (emp.web)     { doc.text(emp.web, pw-34, yd, {align:"right"}); yd+=10; }
  if (emp.email)   { doc.text(emp.email, pw-34, yd, {align:"right"}); }

  // ── Número de cotización
  doc.setFillColor(249,115,22); doc.rect(34, H+10, 6, 30, "F");
  doc.setTextColor(249,115,22); doc.setFont("helvetica","bold"); doc.setFontSize(13);
  doc.text("Cotización: "+num, 44, H+22);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(80,80,80);
  const ahora = new Date();
  const fechaStr = ahora.toLocaleString("es-CO",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
  doc.text("Fecha: "+fechaStr, 44, H+34);

  const asesor = [usuarioData?.nombre, usuarioData?.apellido].filter(Boolean).join(" ");
  if (asesor || usuarioData?.celular) {
    let ya = H+46;
    if (asesor)           { doc.text("Asesor: "+asesor+(usuarioData?.cargo?" · "+usuarioData.cargo:""), 44, ya); ya+=12; }
    if (usuarioData?.celular){ doc.text("Cel: "+usuarioData.celular, 44, ya); }
  }

  addWatermark();

  // ── Cliente
  let sy = H + 75;
  doc.setFontSize(10); doc.setTextColor(30,30,30);
  doc.setFont("helvetica","bold"); doc.text("Cliente:", 34, sy);
  doc.setFont("helvetica","normal"); doc.text(cliente, 60, sy);
  sy += 14;

  // ── Tabla de ítems
  const heads = [["Cant","Ancho (cm)","Largo (cm)","Alto (cm)","m³","Subtotal"]];
  const body  = filas.map(f => f.map(String));

  // Intentar usar autoTable si está disponible
  if (typeof doc.autoTable === "function") {
    doc.autoTable({
      head: heads, body,
      startY: sy,
      margin: { left:34, right:34 },
      headStyles: { fillColor:[7,13,26], textColor:[6,214,200], fontStyle:"bold", fontSize:8 },
      bodyStyles: { fontSize:8, textColor:[40,40,40] },
      alternateRowStyles: { fillColor:[245,250,252] },
      columnStyles: { 0:{halign:"center"}, 4:{halign:"right"}, 5:{halign:"right",fontStyle:"bold"} },
    });
    sy = (doc.lastAutoTable?.finalY || sy) + 10;
  } else {
    // Fallback manual si no hay autoTable
    doc.setFontSize(8); doc.setFont("helvetica","bold");
    const cols = ["Cant","Ancho","Largo","Alto","m³","Subtotal"];
    const widths = [15,30,30,25,25,45];
    let cx = 34;
    doc.setFillColor(7,13,26); doc.rect(34, sy-5, pw-68, 10, "F");
    doc.setTextColor(6,214,200);
    cols.forEach((c,i)=>{ doc.text(c, cx+2, sy+1); cx+=widths[i]; });
    sy+=10; doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
    filas.forEach((fila,ri)=>{
      if(ri%2===0){ doc.setFillColor(245,250,252); doc.rect(34,sy-4,pw-68,8,"F"); }
      cx=34; fila.forEach((v,i)=>{ doc.text(String(v),cx+2,sy+1); cx+=widths[i]; });
      sy+=8;
    });
    sy+=6;
  }

  // ── Totales
  const totales = [
    ["Subtotal:", clpLocal(subtotal)],
    [`IVA (${ivaP}%):`, clpLocal(ivaT)],
    ["TOTAL:", clpLocal(total)],
  ];
  totales.forEach(([label, valor], i)=>{
    const isLast = i === totales.length-1;
    if(isLast){
      doc.setFillColor(7,13,26); doc.rect(pw-134, sy-5, 100, 10, "F");
      doc.setTextColor(6,214,200); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    } else {
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
    }
    doc.text(label, pw-130, sy+1); doc.text(valor, pw-34, sy+1, {align:"right"});
    sy+=12;
  });

  // ── Nota al pie
  sy += 8;
  doc.setFontSize(7.5); doc.setFont("helvetica","italic"); doc.setTextColor(120,120,120);
  doc.text("Cotización válida por 30 días. Precios expresados en COP. " + (emp.nombre||"GESTIUM"), 34, sy);

  doc.save(`Cotizacion_${num}_${cliente.replace(/\s+/g,"_")}.pdf`);
}

function clpLocal(n) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

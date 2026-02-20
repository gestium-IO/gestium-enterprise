// ═══════════════════════════════════════════════════════
//  GESTIUM · cotizaciones.js
//  Módulo de cotizaciones con paginación, soft delete y rate limiting
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, startAfter, where,
  Timestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, clp, fmtM3, fmt, toast, checkRateLimit, softDeleteUpdate } from './utils.js';
import { hasPermission, getLimits } from './features.js';
import { escribirLog } from './logs.js';
import { generarPDF, generarReporte } from './pdf.js';

let _empresaId   = null;
let _empresaData = null;
let _usuarioData = null;
let _logoB64     = null;
let _lastDoc     = null; // para paginación
const PAGE_SIZE  = 30;

export function initCotizaciones(empresaId, empresaData, usuarioData, logoB64Ref) {
  _empresaId   = empresaId;
  _empresaData = empresaData;
  _usuarioData = usuarioData;
  _logoB64     = logoB64Ref;
}
export function setLogoB64(v) { _logoB64 = v; }

/* ── CLIENTES ── */
export async function cargarClientes() {
  if (!_empresaId) return;
  const selectores = ["listaClientes","clienteFiltro","gastoCliente"];
  selectores.forEach(id => {
    const s = $(id); if (!s) return;
    s.innerHTML = id === "gastoCliente"
      ? '<option value="">Seleccionar cliente</option>'
      : '<option value="">-- Seleccionar --</option>';
  });
  const snap = await getDocs(
    query(collection(db,"empresas",_empresaId,"clientes"), orderBy("creadoEn","desc"))
  );
  snap.forEach(d => {
    const n = d.data().nombre || d.id;
    const o = document.createElement("option"); o.value = n; o.textContent = n;
    selectores.forEach(id => { const s=$(id); if(s) s.appendChild(o.cloneNode(true)); });
  });
}

export async function guardarCliente() {
  if (!hasPermission("crear_cliente")) { toast("No tienes permiso para crear clientes", "warn"); return; }
  const n = $("cliente").value.trim();
  if (!n) { toast("Escribe el nombre del cliente", "warn"); return; }
  const col = collection(db,"empresas",_empresaId,"clientes");
  const snap = await getDocs(col); let existe = false;
  snap.forEach(d => { if ((d.data().nombre||"").toLowerCase() === n.toLowerCase()) existe = true; });
  if (existe) { toast("Ese cliente ya existe", "warn"); return; }
  await addDoc(col, { nombre:n, nombreNormalizado:n.toLowerCase(), creadoEn:Timestamp.fromDate(new Date()) });
  await escribirLog("cliente_creado", `Creó cliente "${n}"`);
  await cargarClientes();
  $("cliente").value = "";
  toast("Cliente guardado ✓", "success");
}

/* ── GENERAR COTIZACIÓN ── */
export async function generarCotizacion() {
  if (!hasPermission("crear_cotizacion")) { toast("Sin permiso para crear cotizaciones", "warn"); return; }

  // Rate limiting
  const limites = getLimits();
  const keyDia  = `cot_dia_${_empresaId}_${new Date().toISOString().slice(0,10)}`;
  if (!checkRateLimit(keyDia, limites.cotizacionesDia, 86400000)) {
    toast(`Límite diario alcanzado (${limites.cotizacionesDia} cotizaciones/día en tu plan)`, "warn");
    return;
  }

  const cliente = $("cliente").value.trim() || "Cliente";
  const altura  = parseFloat($("altura").value) || 0;
  const precio  = parseFloat($("precio").value) || 0;
  const ivaP    = parseFloat($("iva").value)    || 0;
  const texto   = $("medidas").value.trim();

  if (!texto)              { toast("Ingresa las medidas", "warn"); return; }
  if (altura <= 0 || precio <= 0) { toast("Altura y precio deben ser mayores a 0", "warn"); return; }

  let filas = [], subtotal = 0, totalM3 = 0;
  texto.split("\n").forEach(raw => {
    let l = raw.trim().replace(/\s+/g,""); if (!l) return;
    let cant = 1;
    if (l.includes("-")) { const p = l.split("-"); cant = parseInt(p[0])||1; l = p[1]; }
    l = l.toUpperCase();
    const pts = l.includes("*") ? l.split("*") : l.split("X");
    const a = parseFloat(pts[0]), b = parseFloat(pts[1]); if (!a||!b) return;
    const m3 = (a/100)*(b/100)*(altura/100)*cant, tl = m3*precio;
    subtotal += tl; totalM3 += m3;
    filas.push([cant, a, b, altura, fmtM3(m3), clp(tl)]);
  });
  if (!filas.length) { toast("No se pudieron leer las medidas. Revisa el formato.", "warn"); return; }

  const ivaT = subtotal*(ivaP/100), total = subtotal+ivaT;
  const empRef = doc(db,"empresas",_empresaId);
  let num = "";

  try {
  await runTransaction(db, async tx => {
    const es = await tx.get(empRef);
    if (!es.exists()) throw new Error("Empresa no encontrada");

    const cnt = (es.data().contador || 0) + 1;
    num = "COT-" + String(cnt).padStart(3, "0");

    tx.update(empRef, { contador: cnt });

    const cotRef = doc(
      db,
      "empresas",
      _empresaId,
      "cotizaciones",
      num
    );

    tx.set(cotRef, {
      numero: num,
      cliente,
      fecha: Timestamp.fromDate(new Date()),
      subtotal,
      iva: ivaT,
      total,
      m3: totalM3,
      estado: "Pendiente",
      medidasTexto: texto,
      altura,
      precio,
      ivaPorcentaje: ivaP,
      eliminado: false,
    });
  });
  } catch(e) { toast("Error al guardar: "+e.message, "error"); return; }

  await escribirLog("cotizacion_generada", `Generó ${num} para ${cliente}`, { numero:num, total });
  generarPDF(_empresaData, _usuarioData, _logoB64, filas, { num, cliente, subtotal, ivaT, ivaP, total });
  await cargarTablaCotizaciones();
  toast(`Cotización ${num} generada ✓`, "success");
}

/* ── TABLA COTIZACIONES (con paginación) ── */
export async function cargarTablaCotizaciones(paginar = false) {
  if (!_empresaId) return;
  const tbody = document.querySelector("#tablaCotizaciones tbody"); if (!tbody) return;

  let q = query(
    collection(db,"empresas",_empresaId,"cotizaciones"),
    where("estado","!=","Cancelada"),
    orderBy("estado"),
    orderBy("fecha","desc"),
    limit(PAGE_SIZE)
  );
  if (paginar && _lastDoc) q = query(q, startAfter(_lastDoc));
  if (!paginar) { tbody.innerHTML = ""; _lastDoc = null; }

  const snap = await getDocs(q);
  if (!snap.empty) _lastDoc = snap.docs[snap.docs.length-1];

  snap.forEach(ds => {
    const d = ds.data(); if (!d.fecha) return;
    const f = d.fecha.toDate();
    const badge = d.estado === "Convertida"
      ? '<span class="badge badge-teal">Confirmada</span>'
      : d.estado === "En espera"
      ? '<span class="badge badge-amber">En espera</span>'
      : '<span class="badge badge-gray">Pendiente</span>';
    tbody.innerHTML += `<tr>
      <td class="mono" style="color:var(--teal)">${d.numero||"-"}</td>
      <td>${d.cliente||"-"}</td>
      <td style="font-size:11px;color:var(--text2)">${fmt(f)}</td>
      <td class="mono">${clp(d.total||0)}</td>
      <td>${badge}</td>
      <td style="display:flex;gap:8px;align-items:center">
        <button onclick="window._redescargar('${ds.id}')" class="btn-icon-teal" title="Descargar PDF">📥</button>
        <select class="estado-sel" onchange="window._accionCot('${ds.id}',this.value)" ${d.estado==="Convertida"?"disabled":""}>
          <option value="">Seleccionar</option>
          <option value="Confirmar">✓ Confirmar venta</option>
          <option value="Pendiente">⏳ Pendiente</option>
          <option value="EnEspera">⏸ En espera</option>
          <option value="Eliminar">✕ Eliminar</option>
        </select>
      </td></tr>`;
  });

  // Botón cargar más
  const btnMas = $("btnCargarMas");
  if (btnMas) btnMas.style.display = snap.size < PAGE_SIZE ? "none" : "block";
}

/* ── ACCIONES ── */
window._redescargar = async function(id) {
  const snap = await getDoc(doc(db,"empresas",_empresaId,"cotizaciones",id));
  if (!snap.exists()) { toast("Cotización no encontrada", "warn"); return; }
  const d = snap.data(); if (!d.medidasTexto) { toast("Datos incompletos", "warn"); return; }
  let filas = [];
  d.medidasTexto.split("\n").forEach(raw => {
    let l = raw.trim().replace(/\s+/g,""); if (!l) return;
    let cant=1; if(l.includes("-")){ const p=l.split("-"); cant=parseInt(p[0])||1; l=p[1]; }
    l=l.toUpperCase();
    const pts=l.includes("*")?l.split("*"):l.split("X");
    const a=parseFloat(pts[0]),b=parseFloat(pts[1]);
    const m3=(a/100)*(b/100)*(d.altura/100)*cant;
    filas.push([cant,a,b,d.altura,fmtM3(m3),clp(m3*d.precio)]);
  });
  generarPDF(_empresaData, _usuarioData, _logoB64, filas, {
    num:d.numero, cliente:d.cliente, subtotal:d.subtotal, ivaT:d.iva, ivaP:d.ivaPorcentaje, total:d.total
  });
};

window._accionCot = async function(id, accion) {
  if (!accion) return;
  const ref = doc(db,"empresas",_empresaId,"cotizaciones",id);
  if (accion === "Confirmar") {
    if (!hasPermission("confirmar_venta")) { toast("Sin permiso para confirmar ventas", "warn"); return; }
    const s = await getDoc(ref); if (!s.exists()) return;
    const d = s.data(); if (d.estado === "Convertida") return;
    await updateDoc(ref, { estado:"Convertida" });
    await escribirLog("cotizacion_confirmada", `Confirmó ${d.numero} de ${d.cliente}`, { numero:d.numero, total:d.total });
    
    // 🔴 CRÍTICO: Asiento contable automático (solo si plan superpremium)
    // Pasa el ID para prevenir duplicados
    try {
      const { crearAsientoAutomatico } = await import('./contabilidad.js');
      const iva = _empresaData?.iva || 19;
      const subtotal = Math.round(d.total / (1 + iva/100));
      await crearAsientoAutomatico("venta_confirmada", {
        id: id, // 🔴 CRUCIAL: ID para prevenir duplicados
        numero: d.numero, 
        cliente: d.cliente,
        total: d.total, 
        subtotal, 
        iva: d.total - subtotal,
      });
    } catch(e) { 
      console.error("Error creando asiento:", e);
      // Módulo contable no disponible o plan sin acceso — continuar
    }
    toast(`Venta ${d.numero} confirmada ✓`, "success");
  } else if (accion === "Pendiente") {
    await updateDoc(ref, { estado:"Pendiente" });
  } else if (accion === "EnEspera") {
    await updateDoc(ref, { estado:"En espera" });
  } else if (accion === "Eliminar") {
    if (!hasPermission("eliminar_cotizacion")) { toast("Sin permiso para eliminar", "warn"); return; }
    if (!confirm("¿Eliminar esta cotización? Se ocultará pero no se borrará del sistema.")) return;
    // SOFT DELETE ✓
    const s = await getDoc(ref); const d = s.data()||{};
    await updateDoc(ref, { estado: "Cancelada" });
    await escribirLog("cotizacion_eliminada", `Eliminó ${d.numero||id}`);
    toast("Cotización eliminada", "info");
  }
  await cargarTablaCotizaciones();
};

/* ── EXPORTAR CSV ── */
export async function exportarCSV() {
  if (!hasPermission("exportar_csv")) { toast("Sin permiso para exportar", "warn"); return; }
  const snap = await getDocs(
    query(collection(db,"empresas",_empresaId,"cotizaciones"),
      where("estado","!=","Cancelada"), orderBy("estado"), orderBy("fecha","desc"))
  );
  let csv = "N°,Cliente,Fecha,Subtotal,IVA,Total,m³,Estado\n";
  snap.forEach(ds => {
    const d = ds.data(); if (!d.fecha) return;
    csv += `${d.numero||""},${d.cliente||""},${fmt(d.fecha.toDate())},${d.subtotal||0},${d.iva||0},${d.total||0},${d.m3||0},${d.estado||""}\n`;
  });
  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `cotizaciones_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  await escribirLog("csv_exportado", "Exportó cotizaciones a CSV");
  toast("CSV exportado ✓", "success");
}

// ═══════════════════════════════════════════════════════
//  GESTIUM · financiero.js
//  Módulo Financiero — Gastos y costos (Premium+)
//  Bloque 1: Validación · Bloque 5: Escalabilidad
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import { auth } from './firebase.js';
import {
  collection, addDoc, getDocs, query,
  where, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, toast, clp, fmt, logError, lockBtn } from './utils.js';
import { hasPermission } from './features.js';
import { escribirLog } from './logs.js';

let _empresaId = null;

export function initFinanciero(empresaId) {
  _empresaId = empresaId;
}

/* ── GUARDAR GASTO ── */
export async function guardarGasto() {
  if (!hasPermission("crear_gasto")) {
    toast("Sin permiso para registrar gastos", "warn");
    return;
  }

  const btn   = $("guardarGastoBtn");
  const unlock = lockBtn(btn, "Guardando...");

  try {
    const fecha     = $("gastoFecha")?.value;
    const categoria = $("gastoCategoria")?.value;
    const valorStr  = $("gastoValor")?.value;
    const desc      = $("gastoDescripcion")?.value.trim();

    // Validaciones frontend (reglas Firestore también validan)
    if (!fecha)     { toast("Selecciona una fecha", "warn"); return; }
    if (!categoria) { toast("Selecciona una categoría", "warn"); return; }
    if (!valorStr || isNaN(Number(valorStr)) || Number(valorStr) <= 0) {
      toast("Ingresa un valor válido mayor a 0", "warn"); return;
    }

    // 🔴 BLOQUE 1: Valor como número, nunca string
    const valor = Number(valorStr);

    const fechaDate = new Date(fecha + "T00:00:00");

    await addDoc(collection(db, "empresas", _empresaId, "gastos"), {
      fecha:       Timestamp.fromDate(fechaDate),
      categoria,
      descripcion: desc || categoria,
      valor,        // número
      eliminado:    false,
      creadoEn:     Timestamp.fromDate(new Date()),
      creadoPor:    auth.currentUser?.uid || "desconocido",
    });

    await escribirLog("gasto_registrado", `Registró gasto: ${categoria} $${valor.toLocaleString("es-CO")}`, { valor, categoria });
    toast("Gasto registrado ✓", "success");

    // Limpiar formulario
    if ($("gastoFecha")) $("gastoFecha").value = "";
    if ($("gastoValor")) $("gastoValor").value = "";
    if ($("gastoDescripcion")) $("gastoDescripcion").value = "";

    await cargarCostos();
  } catch (err) {
    await logError("guardar_gasto", err.message);
    toast("Error registrando gasto: " + err.message, "error");
  } finally {
    unlock();
  }
}

/* ── CARGAR COSTOS / TABLA DE GASTOS ── */
export async function cargarCostos() {
  if (!_empresaId) return;

  const tbody = document.querySelector("#tablaGastos tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Cargando...</td></tr>';

  try {
    // 🔴 BLOQUE 5: Siempre filtrar por mes actual, nunca traer toda la colección
    const hoy   = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

    const q = query(
      collection(db, "empresas", _empresaId, "gastos"),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<=", Timestamp.fromDate(fin)),
      where("eliminado", "==", false),
      orderBy("fecha", "desc"),
      limit(200)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Sin gastos en este período</td></tr>';
      return;
    }

    let totalMes = 0;
    tbody.innerHTML = "";

    snap.forEach(d => {
      const g = d.data();
      totalMes += g.valor || 0;
      tbody.innerHTML += `
        <tr>
          <td style="font-size:12px">${fmt(g.fecha)}</td>
          <td style="font-size:12px">—</td>
          <td><span style="background:rgba(6,214,200,.1);color:var(--teal);padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">${g.categoria}</span></td>
          <td style="font-size:12px;color:var(--text2)">${g.descripcion || "—"}</td>
          <td style="font-size:13px;font-weight:700;color:var(--red)">${clp(g.valor)}</td>
          <td style="font-size:11px;color:var(--text3)">${g.creadoPor?.slice(0,6)}…</td>
        </tr>`;
    });

    // Fila de total
    tbody.innerHTML += `
      <tr style="border-top:2px solid rgba(255,255,255,.1)">
        <td colspan="4" style="text-align:right;font-weight:700;padding:10px 8px;color:var(--text2)">TOTAL MES</td>
        <td style="font-weight:700;color:var(--red);font-size:14px">${clp(totalMes)}</td>
        <td></td>
      </tr>`;

  } catch (err) {
    await logError("cargar_costos", err.message);
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);padding:16px;text-align:center">Error: ${err.message}</td></tr>`;
  }
}

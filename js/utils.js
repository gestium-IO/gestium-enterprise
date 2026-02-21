// ═══════════════════════════════════════════════════════
//  GESTIUM · utils.js
//  Utilidades globales — helpers puros sin dependencias
// ═══════════════════════════════════════════════════════

import { db, auth } from './firebase.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ── SELECTOR RÁPIDO ── */
export function $(id) { return document.getElementById(id); }

/* ── TOAST / NOTIFICACIONES ── */
let _toastTimer = null;

export function toast(msg, tipo = "info", duracion = 3500) {
  let el = document.getElementById("toastGlobal");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastGlobal";  
    el.style.cssText = `
      position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      padding:12px 22px;border-radius:10px;font-size:13px;font-weight:700;
      z-index:9999;pointer-events:none;transition:opacity .25s;
      max-width:90vw;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.4);
    `;
    document.body.appendChild(el);
  }
  const colores = {
    success: { bg: "#06d6c8", text: "#070d1a" },
    error:   { bg: "#ef4444", text: "#fff" },
    warn:    { bg: "#f59e0b", text: "#070d1a" },
    info:    { bg: "#3b82f6", text: "#fff" },
  };
  const c = colores[tipo] || colores.info;
  el.style.background = c.bg;
  el.style.color       = c.text;
  el.textContent       = msg;
  el.style.opacity     = "1";
  el.style.display     = "block";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.opacity = "0"; setTimeout(() => { el.style.display = "none"; }, 300); }, duracion);
}

/* ── LOG DE ERRORES ── */
export async function logError(contexto, mensaje, extra = {}) {
  try {
    await addDoc(collection(db, "errores"), {
      contexto,
      mensaje: String(mensaje).slice(0, 500),
      extra,
      fecha:     Timestamp.fromDate(new Date()),
      // ✅ FIX: Incluir usuario y empresa para trazabilidad en superadmin
      usuario:   auth?.currentUser?.uid  || "anonimo",
      email:     auth?.currentUser?.email || "—",
      tipo:      contexto, // campo tipo para badge en panel superadmin
      empresaId: extra?.empresaId || "—",
    });
  } catch (e) {
    // Silenciar para no crear bucle infinito
    console.error("[GESTIUM][logError]", e);
  }
}

/* ── FORMATO PESOS COP ── */
export function clp(n) {
  if (n === null || n === undefined) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP",
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(n);
}

/* ── FORMATO FECHA LARGA ── */
export function fmt(fecha) {
  if (!fecha) return "—";
  const d = fecha instanceof Date ? fecha : fecha.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── FORMATO FECHA CORTA ── */
export function fmtShort(fecha) {
  if (!fecha) return "—";
  const d = fecha instanceof Date ? fecha : fecha.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/* ── DÍAS RESTANTES ── */
export function diasRestantes(fechaFirestore) {
  if (!fechaFirestore) return 9999;
  const vence = fechaFirestore.toDate ? fechaFirestore.toDate() : new Date(fechaFirestore);
  const hoy   = new Date();
  return Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
}

/* ── GENERAR TOKEN ÚNICO ── */
export function generarToken(len = 24) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/* ── SOFT DELETE (helper para update) ── */
export function softDeleteUpdate() {
  return { eliminado: true, eliminadoEn: Timestamp.fromDate(new Date()) };
}

/* ── DEBOUNCE ── */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ── NORMALIZAR TEXTO (para búsquedas) ── */
export function normalizar(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ── DESCARGAR COMO JSON ── */
export function descargarJSON(obj, nombre = "backup") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── DESCARGAR COMO CSV ── */
export function descargarCSV(filas, nombre = "export") {
  const csv  = filas.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── VALIDAR EMAIL ── */
export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── PREVENIR DOBLE SUBMIT ── */
export function lockBtn(btn, textoLoading = "Procesando...") {
  if (!btn) return () => {};
  const original = btn.textContent;
  btn.disabled    = true;
  btn.textContent = textoLoading;
  return () => { btn.disabled = false; btn.textContent = original; };
}

// ── FORMATO METROS CÚBICOS ─────────────────────────────────────────
// Elimina ceros innecesarios: 85.500 → 85.5  |  1.000 → 1
export function fmtM3(n) {
  return parseFloat(parseFloat(n).toFixed(3)).toString();
}

// ── RATE LIMIT LOCAL (localStorage) ───────────────────────────────
// Controla cuántas veces se puede ejecutar una acción en una ventana de tiempo.
// key: identificador único (ej: "cotizaciones_dia_empresaId")
// maxAcciones: límite permitido (ej: 50)
// ventanaMs: milisegundos de la ventana (ej: 86400000 = 24h)
// Retorna true si está dentro del límite, false si ya lo superó.
export function checkRateLimit(key, maxAcciones, ventanaMs = 86400000) {
  try {
    const ahora  = Date.now();
    const rawData = localStorage.getItem("rl_" + key);
    let data = rawData ? JSON.parse(rawData) : { count: 0, desde: ahora };

    // Si la ventana de tiempo expiró, reiniciar
    if (ahora - data.desde > ventanaMs) {
      data = { count: 0, desde: ahora };
    }

    if (data.count >= maxAcciones) {
      return false; // Límite alcanzado
    }

    data.count++;
    localStorage.setItem("rl_" + key, JSON.stringify(data));
    return true;
  } catch {
    return true; // Si localStorage falla, dejar pasar (no bloquear al usuario)
  }
}

// ═══════════════════════════════════════════════════════
//  GESTIUM · logs.js
//  Registro de auditoría — Bloque 7 y 11 del SaaS
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import { auth } from './firebase.js';
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $ } from './utils.js';

let _empresaId  = null;
let _usuarioData = null;
let _unsubLogs  = null;

export function initLogs(empresaId, usuarioData) {
  _empresaId   = empresaId;
  _usuarioData = usuarioData;
}

/* ── ESCRIBIR LOG ── */
export async function escribirLog(accion, descripcion, extra = {}) {
  if (!_empresaId) return;
  try {
    await addDoc(collection(db, "empresas", _empresaId, "logs"), {
      accion,
      descripcion: String(descripcion).slice(0, 500),
      usuario:     auth.currentUser?.uid || "desconocido",
      email:       auth.currentUser?.email || _usuarioData?.email || "—",
      nombre:      _usuarioData?.nombre || "—",
      extra,
      fecha: Timestamp.fromDate(new Date()),
    });
  } catch (e) {
    console.error("[logs.js] Error escribiendo log:", e.message);
  }
}

/* ── SUSCRIBIR A LOGS EN TIEMPO REAL ── */
export function suscribirLogs() {
  if (!_empresaId) return;
  const tbody = document.querySelector("#tablaLogs tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">Cargando...</td></tr>';

  const q = query(
    collection(db, "empresas", _empresaId, "logs"),
    orderBy("fecha", "desc"),
    limit(100)
  );

  _unsubLogs = onSnapshot(q, (snap) => {
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">Sin registros aún</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    snap.forEach(d => {
      const log = d.data();
      const fecha = log.fecha?.toDate?.() ?? new Date();
      tbody.innerHTML += `
        <tr>
          <td style="font-size:11px;color:var(--text3)">${fecha.toLocaleString("es-CO")}</td>
          <td style="font-size:12px;font-weight:700;color:var(--teal)">${log.accion}</td>
          <td style="font-size:12px">${log.descripcion}</td>
          <td style="font-size:11px;color:var(--text3)">${log.nombre || log.email || "—"}</td>
        </tr>`;
    });
  }, (err) => {
    console.error("[logs.js]", err.message);
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--red);text-align:center;padding:16px">Error cargando logs</td></tr>';
  });
}

/* ── DESUSCRIBIR ── */
export function desuscribirLogs() {
  if (_unsubLogs) { _unsubLogs(); _unsubLogs = null; }
}

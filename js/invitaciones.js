// ═══════════════════════════════════════════════════════
//  GESTIUM · invitaciones.js
//  Sistema de invitaciones por token temporal
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, toast, generarToken, fmt } from './utils.js';
import { hasPermission } from './features.js';
import { escribirLog } from './logs.js';

let _empresaId = null;

export function initInvitaciones(empresaId) {
  _empresaId = empresaId;
}

/* ── CREAR INVITACIÓN ── */
export async function crearInvitacion() {
  if (!hasPermission("crear_invitacion")) { toast("Sin permiso para crear invitaciones", "warn"); return; }

  const rol     = $("invRol")?.value   || "vendedor";
  const email   = $("invEmail")?.value.trim() || "";
  const token   = generarToken(24);
  const expira  = new Date(); expira.setHours(expira.getHours() + 48); // 48h de validez

  await addDoc(collection(db,"empresas",_empresaId,"invitaciones"), {
    token,
    rol,
    emailDestino: email,
    expira:       Timestamp.fromDate(expira),
    usada:        false,
    creadaEn:     Timestamp.fromDate(new Date()),
  });

  await escribirLog("invitacion_creada", `Creó invitación rol:${rol} para ${email||"cualquiera"}`, { token: token.slice(0,8)+"…" });

  const link = `${window.location.origin}${window.location.pathname}?invToken=${token}&empId=${_empresaId}`;
  const msg = `Invitación creada ✓\n\nToken: ${token}\n\nLink directo:\n${link}\n\nVigencia: 48 horas`;
  if ($("invResult")) {
    $("invResult").textContent = link;
    $("invResult").style.display = "block";
  }
  await navigator.clipboard.writeText(link).catch(()=>{});
  toast("Invitación creada y copiada al portapapeles ✓", "success");
  await cargarInvitaciones();
}

/* ── VALIDAR TOKEN AL REGISTRARSE ── */
export async function validarTokenInvitacion(empId, token) {
  const snap = await getDocs(
    query(collection(db,"empresas",empId,"invitaciones"),
      where("token","==",token), where("usada","==",false))
  );
  if (snap.empty) return false;
  const inv = snap.docs[0];
  const data = inv.data();
  if (data.expira && new Date() > data.expira.toDate()) return false; // expirado

  // Marcar como usada
  await updateDoc(doc(db,"empresas",empId,"invitaciones",inv.id), {
    usada:true, usadaEn:Timestamp.fromDate(new Date())
  });
  await escribirLog("invitacion_usada", `Token de invitación usado`, { token: token.slice(0,8)+"…" });
  return true;
}

/* ── CARGAR INVITACIONES ── */
export async function cargarInvitaciones() {
  const tbody = document.querySelector("#tablaInvitaciones tbody");
  if (!tbody || !_empresaId) return;
  const snap = await getDocs(
    query(collection(db,"empresas",_empresaId,"invitaciones"), where("usada","==",false))
  );
  tbody.innerHTML = "";
  if (!snap.size) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">Sin invitaciones activas</td></tr>';
    return;
  }
  snap.forEach(d => {
    const inv = d.data();
    const expira = inv.expira?.toDate();
    const vencida = expira && new Date() > expira;
    tbody.innerHTML += `<tr>
      <td class="mono" style="font-size:11px">${inv.token.slice(0,12)}…</td>
      <td><span class="badge ${inv.rol==='admin'?'badge-teal':'badge-gray'}">${inv.rol}</span></td>
      <td style="font-size:11px">${inv.emailDestino||"—"}</td>
      <td><span class="badge ${vencida?'badge-red':'badge-green'}">${vencida?"Vencida":"Activa"}</span> ${expira?fmt(expira):""}</td>
    </tr>`;
  });
}

/* ── AUTO-RELLENAR DESDE URL ── */
export function checkInvitacionURL() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("invToken");
  const empId  = params.get("empId");
  if (token && empId) {
    const tInput = $("regTokenInvitacion");
    const eInput = $("regEmpresaExistente");
    if (tInput) tInput.value = token;
    if (eInput) eInput.value = empId;
    // Cambiar a modo "unirme a empresa"
    $("modeExistenteBtn")?.click();
    $("loginScreen").style.display  = "none";
    $("registerScreen").style.display = "flex";
    toast("Token de invitación detectado. Completa tu registro.", "info");
  }
}

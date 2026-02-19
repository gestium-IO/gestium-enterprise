// ═══════════════════════════════════════════════════════
//  GESTIUM · superadmin.js
//  Panel de control total — solo superadmin
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import {
  collection, getDocs, getDoc, updateDoc, addDoc,
  doc, query, where, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, clp, fmtShort, fmt, toast } from './utils.js';
import { MRR_PLANS } from './features.js';
import { escribirLog } from './logs.js';

let _empresaIdAdmin = null;

export function initSuperadmin(empresaId) {
  _empresaIdAdmin = empresaId;
}

export async function cargarSuperadmin() {
  const grid = $("adminGrid");
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text3);font-size:13px">Cargando empresas...</div>';

  const snap = await getDocs(collection(db,"empresas"));
  let total=0, activas=0, trial=0, premium=0, mrr=0;
  const empresas = [];

  for (const eDoc of snap.docs) {
    const e = { id:eDoc.id, ...eDoc.data() };
    const usersSnap = await getDocs(collection(db,"empresas",e.id,"usuarios"));
    e._userCount = usersSnap.size;
    const cotSnap = await getDocs(collection(db,"empresas",e.id,"cotizaciones"));
    e._cotCount = cotSnap.size;
    empresas.push(e);
    total++;
    if (e.activa !== false) activas++;
    if (e.plan === "trial")    trial++;
    if (e.plan === "premium" || e.plan === "superpremium")  premium++;
    mrr += (MRR_PLANS[e.plan] || 0);
  }

  // KPIs
  if($("saKpiTotal"))   $("saKpiTotal").textContent   = total;
  if($("saKpiActivas")) $("saKpiActivas").textContent = activas;
  if($("saKpiTrial"))   $("saKpiTrial").textContent   = trial;
  if($("saKpiPremium")) $("saKpiPremium").textContent = premium;
  if($("saKpiMrr"))     $("saKpiMrr").textContent     = clp(mrr);

  // Guardar snapshot de métricas históricas
  try {
    await addDoc(collection(db,"metricas"), {
      fecha:Timestamp.fromDate(new Date()),
      total, activas, trial, premium,
      mrr,
      basicoCount: empresas.filter(e=>e.plan==="basico").length,
    });
  } catch(e) {}

  renderEmpresasGrid(empresas);
  await cargarErrores();
}

function renderEmpresasGrid(empresas) {
  const grid = $("adminGrid"); if (!grid) return;
  const planBadge  = p => p==="superpremium"?'<span class="badge badge-purple">Super Premium</span>':p==="premium"?'<span class="badge badge-teal">Premium</span>':p==="trial"?'<span class="badge badge-amber">Trial</span>':'<span class="badge badge-gray">Básico</span>';
  const estadoBadge = a => a!==false?'<span class="badge badge-green">Activa</span>':'<span class="badge badge-red">Suspendida</span>';

  grid.innerHTML = empresas.map(e => {
    const vencDias = e.vencimiento
      ? Math.ceil((e.vencimiento.toDate()-new Date())/(1000*60*60*24))
      : null;
    const vencColor = vencDias == null ? "" : vencDias < 3 ? "color:var(--red)" : vencDias < 7 ? "color:var(--amber)" : "color:var(--text)";
    return `<div class="empresa-card">
      <div class="empresa-card-top">
        <div>
          <div class="empresa-name">${e.nombre||"Sin nombre"}</div>
          <div class="empresa-id" style="font-size:9px" onclick="navigator.clipboard.writeText('${e.id}').then(()=>window._toast('ID copiado ✓','success'))" title="Click para copiar ID" style="cursor:pointer">📋 ${e.id.slice(0,20)}…</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          ${planBadge(e.plan)} ${estadoBadge(e.activa)}
        </div>
      </div>
      <div class="empresa-stats">
        <div class="estat"><div class="estat-lbl">Usuarios</div><div class="estat-val">${e._userCount}</div></div>
        <div class="estat"><div class="estat-lbl">Cotizaciones</div><div class="estat-val">${e._cotCount}</div></div>
        <div class="estat"><div class="estat-lbl">Creada</div><div class="estat-val" style="font-size:10px">${e.creadaEn?fmtShort(e.creadaEn.toDate()):"—"}</div></div>
        <div class="estat"><div class="estat-lbl">Vencimiento</div><div class="estat-val" style="font-size:10px;${vencColor}">${vencDias!=null?vencDias+"d":"—"}</div></div>
      </div>
      <div class="empresa-actions">
        <select onchange="window._saAccion('${e.id}',this.value);this.value=''" class="inp" style="font-size:11px;flex:1;padding:7px 10px">
          <option value="">Acción...</option>
          <option value="activar">✅ Activar empresa</option>
          <option value="suspender">🔒 Suspender empresa</option>
          <option value="trial">🎁 → Plan Trial</option>
          <option value="basico">📋 → Plan Básico</option>
          <option value="premium">⭐ → Plan Premium</option>
          <option value="superpremium">✨ → Plan Super Premium</option>
          <option value="extender30">📅 +30 días vencimiento</option>
          <option value="extender90">📅 +90 días vencimiento</option>
          <option value="verID">📋 Copiar ID empresa</option>
        </select>
      </div>
    </div>`;
  }).join("");
}

window._toast = (msg, tipo) => toast(msg, tipo);

window._saAccion = async function(empId, accion) {
  if (!accion) return;
  const ref = doc(db,"empresas",empId);
  if (accion === "activar") {
    await updateDoc(ref, { activa:true });
    toast("Empresa activada ✓", "success");
  } else if (accion === "suspender") {
    if (!confirm("¿Suspender esta empresa? Sus usuarios perderán acceso inmediatamente.")) return;
    await updateDoc(ref, { activa:false });
    toast("Empresa suspendida", "warn");
  } else if (["trial","basico","premium","superpremium"].includes(accion)) {
    await updateDoc(ref, { plan:accion });
    toast(`Plan cambiado a ${accion} ✓`, "success");
  } else if (accion === "extender30" || accion === "extender90") {
    const dias = accion === "extender30" ? 30 : 90;
    const s = await getDoc(ref);
    const actual = s.data()?.vencimiento?.toDate() || new Date();
    const nueva  = new Date(actual); nueva.setDate(nueva.getDate()+dias);
    await updateDoc(ref, { vencimiento:Timestamp.fromDate(nueva) });
    toast(`Vencimiento extendido +${dias} días ✓`, "success");
  } else if (accion === "verID") {
    navigator.clipboard.writeText(empId).catch(()=>{});
    toast("ID copiado al portapapeles ✓", "success");
    return;
  }
  await escribirLog("admin_accion", `[ADMIN] Ejecutó "${accion}" en empresa ${empId.slice(0,8)}…`, { empId });
  await cargarSuperadmin(); // refrescar
};

/* ── VISOR DE ERRORES ── */
async function cargarErrores() {
  const tbody = document.querySelector("#tablaErrores tbody");
  if (!tbody) return;
  const snap = await getDocs(
    query(collection(db,"errores"), orderBy("fecha","desc"), limit(30))
  );
  tbody.innerHTML = "";
  if (!snap.size) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">Sin errores registrados ✓</td></tr>'; return; }
  snap.forEach(d => {
    const e = d.data();
    tbody.innerHTML += `<tr>
      <td style="font-size:11px;color:var(--text2)">${e.fecha?fmt(e.fecha.toDate()):"—"}</td>
      <td><span class="badge badge-red">${e.tipo||"—"}</span></td>
      <td style="font-size:12px">${e.mensaje||"—"}</td>
      <td style="font-size:11px;color:var(--text3)">${e.empresaId||"—"} · ${e.usuario||"—"}</td>
    </tr>`;
  });
}

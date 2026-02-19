// ═══════════════════════════════════════════════════════
//  GESTIUM · ui.js
//  Interfaz de usuario: sidebar, notificaciones, onboarding,
//  tooltips, help center — separado de lógica de negocio
// ═══════════════════════════════════════════════════════

import { $ } from './utils.js';
import { hasFeature, isSuperAdmin, planNombre, diasRestantes } from './features.js';
import { db } from './firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════
   SIDEBAR — Construcción dinámica según plan y rol
══════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { key: "cotizaciones", icon: "📋", label: "Cotizaciones",  feature: "cotizaciones" },
  { key: "dashboard",    icon: "📊", label: "Dashboard",     feature: "dashboard" },
  { key: "financiero",   icon: "💰", label: "Financiero",    feature: "finanzas" },
  { key: "contabilidad", icon: "📚", label: "Contabilidad",  feature: "contabilidad" },
  { key: "usuarios",     icon: "👥", label: "Usuarios",      feature: "usuarios" },
  { key: "invitaciones", icon: "🔗", label: "Invitaciones",  feature: "invitaciones" },
  { key: "logs",         icon: "📝", label: "Auditoría",     feature: "logs" },
  { key: "ocr",          icon: "🔍", label: "OCR Medidas",   feature: "ocr" },
  { key: "superadmin",   icon: "⚙️",  label: "Superadmin",   feature: "superadmin" },
];

export function buildSidebar(empresaData, usuarioData) {
  const nav = $("sbNav");
  if (!nav) return;

  nav.innerHTML = "";

  // Sección principal
  const secPrincipal = document.createElement("div");
  secPrincipal.className = "sb-section";
  secPrincipal.textContent = "PRINCIPAL";
  nav.appendChild(secPrincipal);

  NAV_ITEMS.forEach(item => {
    // Filtrar superadmin si no es superadmin
    if (item.key === "superadmin" && !isSuperAdmin()) return;

    const tieneAcceso = hasFeature(item.feature);
    const btn = document.createElement("button");
    btn.className = `sb-item${tieneAcceso ? "" : " locked"}`;
    btn.dataset.modulo = item.key;
    btn.innerHTML = `
      <span style="font-size:16px;flex-shrink:0">${item.icon}</span>
      <span style="flex:1">${item.label}</span>
      ${tieneAcceso ? '<span class="sb-dot" style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);flex-shrink:0"></span>' : '<span style="font-size:9px;color:var(--amber);font-weight:700">🔒</span>'}
    `;

    if (tieneAcceso) {
      btn.addEventListener("click", () => mostrarModulo(item.key));
    } else {
      btn.addEventListener("click", () => {
        import('./utils.js').then(({ toast }) =>
          toast(`"${item.label}" requiere plan ${_planRequerido(item.feature)}`, "warn")
        );
      });
    }

    nav.appendChild(btn);
  });
}

function _planRequerido(feature) {
  const map = {
    finanzas:      "Premium o superior",
    contabilidad:  "SuperPremium",
    ocr:           "SuperPremium",
    superadmin:    "Superadmin",
  };
  return map[feature] || "Premium";
}

/* ── MOSTRAR MÓDULO ── */
export function mostrarModulo(nombre) {
  // Ocultar todos los módulos
  document.querySelectorAll(".page").forEach(p => p.style.display = "none");

  // Mostrar el módulo solicitado
  const mod = document.getElementById(`modulo${_capitalize(nombre)}`);
  if (mod) mod.style.display = "block";

  // Actualizar sidebar activo
  document.querySelectorAll(".sb-item").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(`.sb-item[data-modulo="${nombre}"]`).forEach(b => b.classList.add("active"));

  // Guardar último módulo activo
  try { sessionStorage.setItem("gestium_modulo", nombre); } catch(e) {}
}

function _capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ══════════════════════════════════════════════════════
   TRIAL BANNER
══════════════════════════════════════════════════════ */

export function checkTrialBanner(empresaData) {
  const banner = $("trialBanner");
  if (!banner) return;

  const plan  = empresaData?.plan;
  const fecha = empresaData?.fechaVencimiento || empresaData?.vencimiento;

  if (!fecha) { banner.classList.add("hidden"); return; }

  const dias = diasRestantes(fecha);

  if (plan === "trial" && dias >= 0) {
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span>🎁 Trial gratuito — Te quedan <strong>${dias} día${dias === 1 ? "" : "s"}</strong></span>
        <a href="https://wa.me/573005541411?text=Quiero contratar GESTIUM" target="_blank"
           style="background:var(--teal);color:#070d1a;padding:6px 14px;border-radius:6px;font-weight:700;font-size:12px;text-decoration:none;flex-shrink:0">
          Contratar ahora →
        </a>
      </div>`;
  } else if (dias >= 0 && dias <= 7) {
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span>⚠️ Tu plan vence en <strong>${dias} día${dias === 1 ? "" : "s"}</strong>. Renueva para no perder el acceso.</span>
        <a href="https://wa.me/573005541411?text=Necesito renovar mi plan GESTIUM" target="_blank"
           style="background:var(--amber);color:#070d1a;padding:6px 14px;border-radius:6px;font-weight:700;font-size:12px;text-decoration:none;flex-shrink:0">
          Renovar →
        </a>
      </div>`;
    banner.style.borderColor = "rgba(245,158,11,.3)";
  } else {
    banner.classList.add("hidden");
  }
}

/* ══════════════════════════════════════════════════════
   NOTIFICACIONES PUSH
══════════════════════════════════════════════════════ */

const _notifs = [];

export function pushNotif(icon, mensaje, tipo = "info") {
  const lista = $("notifList");
  const badge = $("notifCount");

  _notifs.unshift({ icon, mensaje, tipo, hora: new Date() });

  // Mantener máximo 20
  if (_notifs.length > 20) _notifs.pop();

  // Actualizar badge
  if (badge) {
    badge.textContent = _notifs.length;
    badge.classList.remove("hidden");
  }

  // Renderizar lista
  if (lista) {
    lista.innerHTML = _notifs.map(n => `
      <div class="notif-item" style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:10px;align-items:flex-start">
        <span style="font-size:18px;flex-shrink:0">${n.icon}</span>
        <div>
          <div style="font-size:12px;color:var(--text)">${n.mensaje}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">${_fmtHora(n.hora)}</div>
        </div>
      </div>`).join("");
  }
}

export function marcarNotificacionesLeidas() {
  _notifs.length = 0;
  const badge = $("notifCount");
  if (badge) { badge.textContent = "0"; badge.classList.add("hidden"); }
  const lista = $("notifList");
  if (lista) lista.innerHTML = '<div class="notif-empty" style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Sin notificaciones</div>';
}

function _fmtHora(d) {
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

/* ══════════════════════════════════════════════════════
   ONBOARDING CHECKLIST
══════════════════════════════════════════════════════ */

export async function renderOnboarding(empresaId, dbInstance, yaCompletado) {
  const contenedor = $("onboardingChecklist");
  if (!contenedor || yaCompletado) return;

  const pasos = [
    { id: "cotizacion1", icon: "📋", titulo: "Crea tu primera cotización", desc: "Ve a Cotizaciones → clic en '+ Nueva' y completa los datos.", modulo: "cotizaciones" },
    { id: "cliente1",    icon: "👤", titulo: "Agrega un cliente",          desc: "En Cotizaciones, clic en '+ Cliente' para añadir tu primer cliente.", modulo: "cotizaciones" },
    { id: "logo",        icon: "🎨", titulo: "Sube el logo de tu empresa", desc: "En el menú lateral, sección Configuración, sube tu logo.", modulo: null },
    { id: "venta1",      icon: "✅", titulo: "Confirma tu primera venta",  desc: "Convierte una cotización a venta desde la tabla.", modulo: "cotizaciones" },
  ];

  const completados = JSON.parse(localStorage.getItem(`gestium_ob_${empresaId}`) || "[]");
  const total       = pasos.length;
  const hechos      = pasos.filter(p => completados.includes(p.id)).length;
  const pct         = Math.round((hechos / total) * 100);

  if (hechos === total) {
    contenedor.style.display = "none";
    try {
      await updateDoc(doc(dbInstance, "empresas", empresaId), { onboardingCompletado: true });
    } catch(e) {}
    return;
  }

  contenedor.style.display = "block";
  contenedor.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-header">
        <span class="onboarding-title">🚀 Primeros pasos</span>
        <span class="onboarding-progress">${hechos}/${total}</span>
      </div>
      <div class="onboarding-bar"><div class="onboarding-bar-fill" style="width:${pct}%"></div></div>
      <div class="onboarding-steps">
        ${pasos.map(p => {
          const done = completados.includes(p.id);
          return `
            <div class="onboarding-step ${done ? "done" : ""}" style="cursor:${p.modulo && !done ? "pointer" : "default"}"
                 ${p.modulo && !done ? `onclick="mostrarModulo('${p.modulo}');window._obMarcar('${p.id}')"` : ""}>
              <span class="onboarding-check">${done ? "✅" : "⬜"}</span>
              <div>
                <strong>${p.icon} ${p.titulo}</strong>
                <p>${p.desc}</p>
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>`;

  // Función global para marcar paso
  window._obMarcar = (id) => {
    const completados = JSON.parse(localStorage.getItem(`gestium_ob_${empresaId}`) || "[]");
    if (!completados.includes(id)) {
      completados.push(id);
      localStorage.setItem(`gestium_ob_${empresaId}`, JSON.stringify(completados));
    }
  };

  // Exponer mostrarModulo globalmente para el onclick inline
  window.mostrarModulo = mostrarModulo;
}

/* ══════════════════════════════════════════════════════
   TOOLTIPS
══════════════════════════════════════════════════════ */

export function initTooltips() {
  // Tooltips simples con data-tip
  document.querySelectorAll("[data-tip]").forEach(el => {
    let tip = null;
    el.addEventListener("mouseenter", () => {
      tip = document.createElement("div");
      tip.textContent = el.dataset.tip;
      tip.style.cssText = `
        position:fixed;background:#1a2a45;color:#e2e8f0;padding:6px 12px;
        border-radius:8px;font-size:11px;font-weight:600;z-index:99999;
        pointer-events:none;white-space:nowrap;border:1px solid rgba(6,214,200,.2);
        box-shadow:0 4px 16px rgba(0,0,0,.4)`;
      document.body.appendChild(tip);

      const pos = el.getBoundingClientRect();
      tip.style.top  = (pos.bottom + 6) + "px";
      tip.style.left = (pos.left + pos.width/2 - tip.offsetWidth/2) + "px";
    });
    el.addEventListener("mouseleave", () => { tip?.remove(); tip = null; });
  });
}

/* ══════════════════════════════════════════════════════
   HELP CENTER
══════════════════════════════════════════════════════ */

export function initHelpCenter() {
  const helpBtn = $("helpBtn");
  if (!helpBtn) return;

  helpBtn.addEventListener("click", () => {
    let modal = $("helpModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "helpModal";
      modal.style.cssText = "position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(7,13,26,.8);backdrop-filter:blur(4px)";
      modal.innerHTML = `
        <div class="help-content" style="max-width:520px;width:100%;background:var(--navy2);border-radius:16px;border:1px solid rgba(6,214,200,.15);box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;max-height:80vh;overflow-y:auto">
          <div class="help-header" style="padding:22px 28px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--navy2);z-index:1">
            <span style="font-size:16px;font-weight:800">❓ Centro de Ayuda</span>
            <button onclick="document.getElementById('helpModal').style.display='none'" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:4px">✕</button>
          </div>
          <div style="padding:24px 28px;display:flex;flex-direction:column;gap:20px">
            ${_helpSections()}
            <div style="background:rgba(6,214,200,.06);border:1px solid rgba(6,214,200,.12);border-radius:12px;padding:16px">
              <div style="font-size:12px;font-weight:800;color:var(--teal);margin-bottom:10px">📞 CONTACTO SOPORTE</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <a href="https://wa.me/573005541411?text=Necesito soporte con GESTIUM" target="_blank" style="background:#25d366;color:#070d1a;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;text-align:center">📱 WhatsApp Soporte</a>
                <a href="mailto:gestium.inteligencia@gmail.com?subject=Soporte GESTIUM" style="background:rgba(249,115,22,.12);color:var(--orange);padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;text-align:center;border:1px solid rgba(249,115,22,.2)">✉️ gestium.inteligencia@gmail.com</a>
              </div>
              <div style="display:flex;gap:12px;justify-content:center;margin-top:10px">
                <a href="https://www.facebook.com/GestiumInteligenciaOperativa" target="_blank" style="color:var(--text3);font-size:12px;text-decoration:none">📘 Facebook</a>
                <a href="https://www.instagram.com/GestiumInteligenciaOperativa" target="_blank" style="color:var(--text3);font-size:12px;text-decoration:none">📸 Instagram</a>
                <a href="https://www.linkedin.com/company/GestiumInteligenciaOperativa" target="_blank" style="color:var(--text3);font-size:12px;text-decoration:none">💼 LinkedIn</a>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
    } else {
      modal.style.display = "flex";
    }
  });
}

function _helpSections() {
  const secciones = [
    {
      titulo: "📋 Cotizaciones",
      items: [
        "Clic en '+ Nueva' para crear una cotización",
        "Agrega ítems con cantidad, descripción y precio",
        "Descarga el PDF con el botón 📄",
        "'Confirmar venta' convierte la cotización en venta real",
      ]
    },
    {
      titulo: "💰 Financiero (Premium+)",
      items: [
        "Registra gastos por categoría en la pestaña Financiero",
        "El dashboard muestra ingresos vs gastos del mes",
        "Selecciona el mes para ver el reporte detallado",
      ]
    },
    {
      titulo: "📚 Contabilidad (SuperPremium)",
      items: [
        "El libro diario se llena automáticamente al confirmar ventas",
        "Crea asientos manuales en 'Asiento Manual'",
        "Los periodos cerrados no permiten modificaciones",
        "Descarga el libro diario en CSV",
      ]
    },
    {
      titulo: "👥 Usuarios e Invitaciones",
      items: [
        "Ve a 'Invitaciones' para generar un link de acceso",
        "El link es válido por 48 horas",
        "El nuevo usuario se registra con ese link y queda en tu empresa",
      ]
    },
  ];

  return secciones.map(s => `
    <div>
      <div style="font-size:13px;font-weight:800;color:var(--teal);margin-bottom:8px">${s.titulo}</div>
      <ul style="padding-left:16px;margin:0;display:flex;flex-direction:column;gap:4px">
        ${s.items.map(i => `<li style="font-size:12px;color:var(--text2);line-height:1.6">${i}</li>`).join("")}
      </ul>
    </div>`).join("");
}

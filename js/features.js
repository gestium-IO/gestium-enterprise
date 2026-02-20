// GESTIUM · features.js
// 
// 🔴 CRÍTICO: Este archivo solo valida en FRONTEND
// Para seguridad real, debes configurar reglas de Firestore:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /empresas/{empresaId} {
//       allow read: if request.auth != null && 
//         get(/databases/$(database)/documents/Usuarios/$(request.auth.uid)).data.empresaId == empresaId;
//       
//       match /libroDiario/{asientoId} {
//         allow read: if request.auth != null &&
//           get(/databases/$(database)/documents/Usuarios/$(request.auth.uid)).data.empresaId == empresaId &&
//           get(/databases/$(database)/documents/empresas/$(empresaId)).data.plan in ['superpremium', 'superadmin'];
//         allow write: if request.auth != null &&
//           request.resource.data.cuadrado == true &&
//           request.resource.data.lineas.size() > 0;
//       }
//     }
//   }
// }

export const PLAN_LIMITS = {
  trial:        { cotizacionesDia:10,   pdfHora:5,   gastos:false, contabilidad:false, ocr:false },
  basico:       { cotizacionesDia:25,   pdfHora:5,   gastos:false, contabilidad:false, ocr:false },
  premium:      { cotizacionesDia:50,   pdfHora:10,  gastos:true,  contabilidad:false, ocr:false },
  superpremium: { cotizacionesDia:999,  pdfHora:999, gastos:true,  contabilidad:true,  ocr:true  },
  superadmin:   { cotizacionesDia:9999, pdfHora:999, gastos:true,  contabilidad:true,  ocr:true  },
};

export const PLAN_FEATURES = {
  trial:        ["cotizaciones","dashboard"],
  basico:       ["cotizaciones","dashboard"],
  premium:      ["cotizaciones","dashboard","finanzas","logs","usuarios","invitaciones"],
  superpremium: ["cotizaciones","dashboard","finanzas","logs","usuarios","invitaciones","contabilidad","ocr"],
  superadmin:   ["cotizaciones","dashboard","finanzas","logs","usuarios","invitaciones","contabilidad","ocr","superadmin"],
};

export const ROLE_PERMISSIONS = {
  admin: ["crear_cliente","editar_cliente","eliminar_cliente","crear_cotizacion","editar_cotizacion","eliminar_cotizacion","confirmar_venta","ver_dashboard","exportar_csv","ver_finanzas","crear_gasto","eliminar_gasto","ver_logs","ver_usuarios","crear_invitacion","subir_logo","backup","ver_contabilidad","crear_asiento","ver_reportes_contables","usar_ocr"],
  vendedor: ["crear_cliente","crear_cotizacion","confirmar_venta","ver_dashboard","usar_ocr"],
  contabilidad: ["ver_dashboard","ver_finanzas","exportar_csv","ver_contabilidad","crear_asiento","ver_reportes_contables"],
};

export const MRR_PLANS = { basico:65000, premium:119000, superpremium:229000, trial:0, superadmin:0 };

let _e=null,_u=null;

export function initFeatures(e,u){_e=e;_u=u;}
export function efectivoPlan(){if(_u?.superadmin)return"superadmin";return _e?.plan||"trial";}
export function hasFeature(f){return(PLAN_FEATURES[efectivoPlan()]||[]).includes(f);}
export function hasPermission(p){if(_u?.superadmin)return true;return(ROLE_PERMISSIONS[_u?.rol||"vendedor"]||[]).includes(p);}
export function isSuperAdmin(){return _u?.superadmin===true;}
export function getLimits(){return PLAN_LIMITS[efectivoPlan()]||PLAN_LIMITS.trial;}
export function planNombre(){const m={trial:"Trial",basico:"Básico",premium:"Premium",superpremium:"Super Premium",superadmin:"Superadmin"};return m[efectivoPlan()]||efectivoPlan();}

// 🔴 CRÍTICO: Funciones de bloqueo explícito
export function bloquearModulo(nombreModulo) {
  const modulo = document.querySelector(`#modulo${nombreModulo}`);
  if (modulo) {
    modulo.innerHTML = `
      <div style="padding:60px 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:20px">🔒</div>
        <h2 style="font-size:22px;color:var(--text);margin-bottom:12px">Módulo no disponible</h2>
        <p style="color:var(--text3);margin-bottom:24px">
          Tu plan actual (${planNombre()}) no incluye acceso a ${nombreModulo}.
        </p>
        <p style="color:var(--text3);font-size:13px">
          Actualiza tu plan para desbloquear esta funcionalidad.
        </p>
      </div>`;
  }
}

export function verificarAccesoModulo(nombreModulo, featureRequerido) {
  if (!hasFeature(featureRequerido)) {
    bloquearModulo(nombreModulo);
    return false;
  }
  return true;
}


/* ── DÍAS RESTANTES ── */
export function diasRestantes(fecha) {
  try {
    const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const diff = Math.ceil((f - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  } catch(e) { return 0; }
}

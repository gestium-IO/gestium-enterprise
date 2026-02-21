// ═══════════════════════════════════════════════════════
//  GESTIUM · auth.js
//  Autenticación y manejo de sesión
// ═══════════════════════════════════════════════════════

import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, Timestamp, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, toast, logError, diasRestantes } from './utils.js';
import { initFeatures, hasFeature, isSuperAdmin } from './features.js';
import { buildSidebar, mostrarModulo } from './ui.js';

export let empresaId   = null;
export let empresaData = null;
export let usuarioData = null;

export function setEmpresaData(data) { empresaData = data; }

export async function entrarComoEmpresa(nuevoEmpresaId) {
  if (!usuarioData?.superadmin) return;

  const snap = await getDoc(doc(db, "empresas", nuevoEmpresaId));
  if (!snap.exists()) {
    toast("Empresa no encontrada", "error");
    return;
  }

  empresaId = nuevoEmpresaId;
  empresaData = snap.data();

  localStorage.setItem(`gestium_emp_${auth.currentUser.uid}`, nuevoEmpresaId);

  initFeatures(empresaData, usuarioData);

  // ✅ FIX: Desuscribir todos los listeners onSnapshot activos antes del reload
  // para evitar que se disparen con datos de la empresa anterior
  if (window._gestiumUnsubscribers && Array.isArray(window._gestiumUnsubscribers)) {
    window._gestiumUnsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
    window._gestiumUnsubscribers = [];
  }

  // ✅ FIX: Banner de SOPORTE ACTIVO visible al entrar como empresa
  localStorage.setItem("gestium_soporte_activo", nuevoEmpresaId);

  location.reload();
}

/* ── LOGIN ── */
export function initLogin() {
  $("togglePassword")?.addEventListener("click", () => {
    const p = $("loginPassword");
    p.type = p.type === "password" ? "text" : "password";
    $("togglePassword").textContent = p.type === "password" ? "👁" : "🙈";
  });

  $("loginBtn")?.addEventListener("click", async () => {
    $("loginMessage").textContent = "";
    const e = $("loginEmail").value.trim(), p = $("loginPassword").value;
    if (!e || !p) { $("loginMessage").textContent = "Ingresa correo y contraseña"; return; }
    setLoading(true);
    try {
      await setPersistence(auth, $("remember")?.checked ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, e, p);
    } catch (err) {
      const msgs = {
        "auth/user-not-found": "El usuario no existe.",
        "auth/wrong-password": "Contraseña incorrecta.",
        "auth/invalid-email": "Correo no válido.",
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/too-many-requests": "Demasiados intentos. Espera unos minutos."
      };
      $("loginMessage").textContent = msgs[err.code] || "Error al iniciar sesión.";
      errorVisual();
      setLoading(false);
    }
  });

  $("resetBtn")?.addEventListener("click", async () => {
    const e = $("loginEmail").value.trim();
    if (!e) { $("loginMessage").textContent = "Escribe tu correo primero"; return; }
    try {
      await sendPasswordResetEmail(auth, e);
      $("loginMessage").style.color = "#06d6c8";
      $("loginMessage").textContent = "Correo de recuperación enviado ✓";
      setTimeout(() => { $("loginMessage").textContent = ""; $("loginMessage").style.color = ""; }, 5000);
    } catch (err) { $("loginMessage").textContent = err.message; }
  });

  $("showRegister")?.addEventListener("click", () => {
    $("loginScreen").style.display = "none";
    $("registerScreen").style.display = "flex";
  });

  $("backToLogin")?.addEventListener("click", () => {
    $("registerScreen").style.display = "none";
    $("loginScreen").style.display = "flex";
  });
}

/* ── REGISTRO ── */
export function initRegister() {
  $("modeNuevaBtn")?.addEventListener("click", () => {
    $("regModoEmpresa").value = "nueva";
    $("modeNuevaBtn").classList.add("on");
    $("modeExistenteBtn").classList.remove("on");
    $("bloqueNuevaEmpresa").style.display = "block";
    $("bloqueEmpresaExistente").style.display = "none";
  });
  $("modeExistenteBtn")?.addEventListener("click", () => {
    $("regModoEmpresa").value = "existente";
    $("modeExistenteBtn").classList.add("on");
    $("modeNuevaBtn").classList.remove("on");
    $("bloqueNuevaEmpresa").style.display = "none";
    $("bloqueEmpresaExistente").style.display = "block";
  });

  $("registerBtn")?.addEventListener("click", async () => {
    const msg = $("registerMessage"); msg.textContent = "";
    const modo     = $("regModoEmpresa").value;
    const nomEmp   = $("regEmpresa")?.value.trim() || "";
    const nomUser  = $("regNombreUsuario").value.trim();
    const apUser   = $("regApellidoUsuario")?.value.trim() || "";
    const cargo    = $("regCargoUsuario")?.value.trim() || "";
    const celular  = $("regCelularUsuario").value.trim();
    const email    = $("regEmail").value.trim();
    const password = $("regPassword").value;
    const planSel  = $("regPlan")?.value || "trial";
    const idExt    = $("regEmpresaExistente")?.value.trim() || "";

    if (!nomUser || !celular || !email || !password) {
      msg.textContent = "Nombre, celular, correo y contraseña son obligatorios"; return;
    }
    if (password.length < 6) { msg.textContent = "Contraseña mínimo 6 caracteres"; return; }
    if (modo === "nueva" && !nomEmp) { msg.textContent = "Escribe el nombre de la empresa"; return; }
    if (modo === "existente" && !idExt) { msg.textContent = "Ingresa el ID de la empresa"; return; }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      let empId = "";

      if (modo === "nueva") {
        const empRef = doc(collection(db, "empresas"));
        empId = empRef.id;
        const trial = new Date(); trial.setDate(trial.getDate() + 7);
        await setDoc(empRef, {
          nombre: nomEmp,
          nit: $("regNitEmpresa")?.value.trim() || "",
          telefono: $("regTelefonoEmpresa")?.value.trim() || "",
          direccion: $("regDireccionEmpresa")?.value.trim() || "",
          ciudad: $("regCiudadEmpresa")?.value.trim() || "",
          pais: $("regPaisEmpresa")?.value.trim() || "Colombia",
          web: $("regWebEmpresa")?.value.trim() || "",
          email: $("regEmailEmpresa")?.value.trim() || email,
          plan: planSel,
          contador: 0,
          // 🔴 fechaVencimiento: coincide con reglas Firestore
          fechaVencimiento: Timestamp.fromDate(trial),
          vencimiento: Timestamp.fromDate(trial), // compatibilidad backwards
          logo: null,
          activa: true,
          creadaEn: Timestamp.fromDate(new Date()),
          onboardingCompletado: false,
          // ✅ Contadores cacheados para superadmin (evitan subqueries O(N))
          userCount: 1, // empieza en 1 (el dueño)
          cotCount:  0, // se incrementa en generarCotizacion()
        });
      } else {
        empId = idExt;
        // Verificar token de invitación si existe
        const tokenInput = $("regTokenInvitacion")?.value.trim();
        if (tokenInput) {
          const { validarTokenInvitacion } = await import('./invitaciones.js');
          const ok = await validarTokenInvitacion(empId, tokenInput);
          if (!ok) { msg.textContent = "Token de invitación inválido o expirado"; return; }
        }
        const s = await getDoc(doc(db, "empresas", empId));
        if (!s.exists()) { msg.textContent = "Empresa no encontrada"; return; }
      }

      // 🔴 CRÍTICO: Guardar usuario en subcolección de empresa (multiempresa)
      // Incrementar userCount si se une a empresa existente
      if (modo === "existente") {
        await updateDoc(doc(db, "empresas", empId), { userCount: increment(1) });
      }
      await setDoc(doc(db, "empresas", empId, "usuarios", user.uid), {
        email: user.email,
        nombre: nomUser,
        apellido: apUser,
        cargo,
        celular,
        telefono: $("regTelefonoUsuario")?.value.trim() || "",
        empresaId: empId,
        rol: "admin",
        activo: true,
        superadmin: false,
        creadoEn: Timestamp.fromDate(new Date()),
      });

      // Meta ligero: permite que auth pueda encontrar empresa sin escanear todo
      await setDoc(doc(db, "usuariosMeta", user.uid), {
        empresaId: empId,
        email: user.email,
        creadoEn: Timestamp.fromDate(new Date()),
      });

      toast("¡Cuenta creada! Iniciando sesión...", "success");
      $("registerScreen").style.display = "none";
      $("loginScreen").style.display = "flex";
    } catch (e) {
      msg.textContent = e.message || "Error creando cuenta";
      await logError("registro", e.message, { email });
    }
  });
}

/* ── AUTH STATE ── */
export function initAuthState(callbacks) {
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) { callbacks.onLogout(); setLoading(false); return; }

   // 🔴 1️⃣ Verificar si es superadmin GLOBAL
const superSnap = await getDoc(doc(db, "superadmin", user.uid));
const cachedEmpId = localStorage.getItem(`gestium_emp_${user.uid}`);

if (superSnap.exists() && superSnap.data().activo === true && !cachedEmpId) {

  empresaId = "GLOBAL_SUPERADMIN";

  const globalSnap = await getDoc(doc(db, "empresas", empresaId));

  if (!globalSnap.exists()) {
    await doSignOut();
    toast("Empresa global no configurada.", "error");
    return;
  }

  empresaData = globalSnap.data();

  usuarioData = {
    superadmin: true,
    activo: true,
    nombre: user.email,
    rol: "superadmin"
  };

  localStorage.setItem(`gestium_emp_${user.uid}`, empresaId);

  initFeatures(empresaData, usuarioData);
  callbacks.onLogin(user, empresaId, empresaData, usuarioData);
  setLoading(false);
  return;
}

// 🔵 FLUJO NORMAL (usuarios de empresa)

let uData = null;
let eId = null;

// Intentar desde cache
if (cachedEmpId) {
  const uSnap = await getDoc(doc(db, "empresas", cachedEmpId, "usuarios", user.uid));
  if (uSnap.exists()) { uData = uSnap.data(); eId = cachedEmpId; }
}

// Fallback por usuariosMeta
if (!uData) {
  const metaSnap = await getDoc(doc(db, "usuariosMeta", user.uid));
  if (metaSnap.exists()) {
    eId = metaSnap.data().empresaId;
    if (eId) {
      localStorage.setItem(`gestium_emp_${user.uid}`, eId);
      const uSnap2 = await getDoc(doc(db, "empresas", eId, "usuarios", user.uid));
      if (uSnap2.exists()) uData = uSnap2.data();
    }
  }
}

if (!uData || !eId) {
  await doSignOut();
  toast("Usuario no configurado. Contacta al soporte.", "error");
  return;
}

usuarioData = uData;
if (!usuarioData.activo) {
  await doSignOut();
  toast("Usuario desactivado.", "warn");
  return;
}

empresaId = eId;
localStorage.setItem(`gestium_emp_${user.uid}`, empresaId);

const eSnap = await getDoc(doc(db, "empresas", empresaId));
if (!eSnap.exists()) {
  await doSignOut();
  toast("Empresa no encontrada.", "error");
  return;
}

empresaData = eSnap.data() || {};
      // Suspensión
      if (empresaData.activa === false) { callbacks.onSuspended("Cuenta suspendida. Contacta al soporte."); return; }

      // Vencimiento (no aplica a superadmin)
      const fechaVenc = empresaData.fechaVencimiento || empresaData.vencimiento;
      if (!usuarioData.superadmin && fechaVenc) {
        const dias = diasRestantes(fechaVenc);
        if (dias < 0) { callbacks.onSuspended("Tu plan ha vencido. Renueva para continuar."); return; }
      }

      initFeatures(empresaData, usuarioData);
      callbacks.onLogin(user, empresaId, empresaData, usuarioData);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      await logError("auth_state", err.message || String(err));
      await doSignOut();
    }
  });
}

export async function doSignOut() {
  try { await signOut(auth); } catch (e) {}
}

/* ── HELPERS VISUALES ── */
function setLoading(on) {
  const btn = $("loginBtn"); if (!btn) return;
  btn.disabled = on;
  const t = $("loginText"), s = $("loginSpinner");
  if (t) t.style.display = on ? "none" : "inline";
  if (s) s.style.display = on ? "inline" : "none";
}
function errorVisual() {
  ["loginEmail","loginPassword"].forEach(id => $(id)?.classList.add("input-error"));
  $("loginBtn")?.classList.add("shake");
  setTimeout(() => $("loginBtn")?.classList.remove("shake"), 350);
  const c = () => ["loginEmail","loginPassword"].forEach(id => $(id)?.classList.remove("input-error"));
  $("loginEmail")?.addEventListener("input", c, { once: true });
  $("loginPassword")?.addEventListener("input", c, { once: true });
}

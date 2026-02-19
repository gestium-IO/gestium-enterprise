// ═══════════════════════════════════════════════════════
//  GESTIUM · firebase.js
//  Configuración central de Firebase
//  ⚠️ En producción, usa variables de entorno o config externa
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage }    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

// ── DEV vs PROD ──
// Para usar entorno de desarrollo, cambia a firebaseConfigDev
const IS_DEV = false;

const firebaseConfigPROD = {
  apiKey:            "AIzaSyBJrHrwbp_udn-KuBAS75_dbOH4xsQW_KI",
  authDomain:        "gestium-76570.firebaseapp.com",
  projectId:         "gestium-76570",
  storageBucket:     "gestium-76570.firebasestorage.app",
  messagingSenderId: "720694044667",
  appId:             "1:720694044667:web:b864af5adb53e473690d5e"
};

// Para dev: crea un segundo proyecto en Firebase Console llamado "gestium-dev"
// y pega sus credenciales aquí:
const firebaseConfigDEV = {
  apiKey:            "REEMPLAZA_CON_TU_API_KEY_DEV",
  authDomain:        "gestium-dev.firebaseapp.com",
  projectId:         "gestium-dev",
  storageBucket:     "gestium-dev.appspot.com",
  messagingSenderId: "TU_SENDER_ID_DEV",
  appId:             "TU_APP_ID_DEV"
};

const config = IS_DEV ? firebaseConfigDEV : firebaseConfigPROD;

export const app     = initializeApp(config);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export const IS_DEVELOPMENT = IS_DEV;

console.log(`[GESTIUM] Entorno: ${IS_DEV ? "🔧 DESARROLLO" : "🚀 PRODUCCIÓN"}`);

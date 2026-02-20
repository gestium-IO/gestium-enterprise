// ═══════════════════════════════════════════════════════
//  GESTIUM · firebase.js — Proyecto: gestium-2d40b
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage }    from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBF246-DxbLTyH-zXHlrSh92_Tq2JD7cfE",
  authDomain:        "gestium-2d40b.firebaseapp.com",
  projectId:         "gestium-2d40b",
  storageBucket:     "gestium-2d40b.firebasestorage.app",
  messagingSenderId: "949260689854",
  appId:             "1:949260689854:web:0b69f4e7d8ed0e9ac759ef"
};

export const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

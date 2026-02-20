// ═══════════════════════════════════════════════════════
//  GESTIUM · ocr.js — OCR con Google Vision (SuperPremium/Premium)
//  ✅ Envía token Firebase para seguridad real
//  ✅ Muestra contador de uso mensual
// ═══════════════════════════════════════════════════════

import { $, toast, logError, lockBtn } from './utils.js';
import { hasFeature } from './features.js';
import { escribirLog } from './logs.js';
import { auth } from './firebase.js';

const MAX_SIZE_MB   = 4;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

let _onTextCallback = null;

export function initOCR(onTextCallback) {
  _onTextCallback = onTextCallback;
  _bindEvents();
}

function _bindEvents() {
  const fileInput  = $("ocrImageInput");
  const leerBtn    = $("ocrLeerBtn");
  const limpiarBtn = $("ocrLimpiarBtn");
  const usarBtn    = $("ocrUsarBtn");

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast("Solo se aceptan imágenes JPG, PNG, WEBP o GIF", "warn");
      fileInput.value = ""; return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast(`La imagen supera ${MAX_SIZE_MB}MB`, "warn");
      fileInput.value = ""; return;
    }

    const preview = $("ocrPreview");
    if (preview) {
      const reader = new FileReader();
      reader.onload = (ev) => { preview.src = ev.target.result; preview.style.display = "block"; };
      reader.readAsDataURL(file);
    }
  });

  leerBtn?.addEventListener("click", async () => {
    if (!hasFeature("ocr")) {
      toast("El OCR requiere Plan Premium o SuperPremium", "warn");
      return;
    }

    const file = fileInput?.files[0];
    if (!file) { toast("Primero selecciona una imagen", "warn"); return; }

    const unlock = lockBtn(leerBtn, "Leyendo con IA...");
    const hint   = $("ocrHint");
    if (hint) hint.textContent = "Procesando imagen con Google Vision...";

    try {
      const base64 = await _fileToBase64(file);
      const result = await _llamarOCR(base64);

      const textarea = $("ocrTexto");
      if (textarea) textarea.value = result.text || "Sin texto detectado";

      // Mostrar contador de uso
      if (hint && result.limite) {
        hint.textContent = `✓ Listo · Usos este mes: ${result.usado}/${result.limite}`;
        if (result.restante <= 3) hint.style.color = "#f59e0b";
      } else if (hint) {
        hint.textContent = "✓ Lectura completada";
      }

      await escribirLog("ocr_usado", `OCR procesado (${(file.size/1024).toFixed(0)}KB) · usos: ${result.usado}/${result.limite}`);
      toast("Texto extraído con Google Vision ✓", "success");
    } catch (err) {
      await logError("ocr", err.message);
      if (hint) { hint.textContent = ""; hint.style.color = ""; }
      // Mostrar el mensaje de error real al usuario
      toast(err.message, "error");
    } finally {
      unlock();
    }
  });

  limpiarBtn?.addEventListener("click", () => {
    if (fileInput) fileInput.value = "";
    const preview = $("ocrPreview");
    if (preview) { preview.src = ""; preview.style.display = "none"; }
    const textarea = $("ocrTexto");
    if (textarea)  textarea.value = "";
    const hint = $("ocrHint");
    if (hint)  { hint.textContent = ""; hint.style.color = ""; }
  });

  usarBtn?.addEventListener("click", () => {
    const texto = $("ocrTexto")?.value.trim();
    if (!texto) { toast("No hay texto OCR para usar", "warn"); return; }
    if (typeof _onTextCallback === "function") _onTextCallback(texto);
    const medidas = $("medidas");
    if (medidas) {
      medidas.value = texto;
      toast("Medidas copiadas al cotizador ✓", "success");
    }
  });
}

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsDataURL(file);
  });
}

// Llama al backend con token Firebase para seguridad real
async function _llamarOCR(base64Image) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesión expirada. Inicia sesión nuevamente.");

  let idToken;
  try {
    idToken = await user.getIdToken(true); // true = forzar refresh
  } catch {
    throw new Error("Error obteniendo token de sesión");
  }

  let res;
  try {
    res = await fetch("/.netlify/functions/ocr", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ image: base64Image }),
    });
  } catch {
    throw new Error("OCR no disponible. Verifica que estés en la URL de Netlify, no en localhost.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Errores específicos con mensajes claros
    if (res.status === 401) throw new Error("Sesión inválida. Recarga la página.");
    if (res.status === 403) throw new Error(data.error || "Plan insuficiente para OCR.");
    if (res.status === 429) throw new Error(data.error || "Límite OCR alcanzado este mes.");
    throw new Error(data.error || `Error ${res.status} al procesar imagen`);
  }

  return data;
}

// ═══════════════════════════════════════════════════════
//  GESTIUM · ocr.js
//  OCR con Google Cloud Vision — Solo SuperPremium
//  🔴 API key SOLO en variable GOOGLE_VISION_KEY de Netlify
// ═══════════════════════════════════════════════════════

import { $, toast, logError, lockBtn } from './utils.js';
import { hasFeature } from './features.js';
import { escribirLog } from './logs.js';

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
      fileInput.value = "";
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast(`La imagen supera ${MAX_SIZE_MB}MB. Comprime la imagen.`, "warn");
      fileInput.value = "";
      return;
    }

    const preview = $("ocrPreview");
    if (preview) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });

  leerBtn?.addEventListener("click", async () => {
    if (!hasFeature("ocr")) {
      toast("El OCR está disponible solo en Plan SuperPremium", "warn");
      return;
    }

    const file = fileInput?.files[0];
    if (!file) { toast("Primero selecciona una imagen", "warn"); return; }

    const unlock = lockBtn(leerBtn, "Leyendo con IA...");
    const hint   = $("ocrHint");
    if (hint) hint.textContent = "Procesando imagen con Google Vision...";

    try {
      const base64 = await _fileToBase64(file);
      const texto  = await _llamarGoogleVision(base64);

      const textarea = $("ocrTexto");
      if (textarea) textarea.value = texto;
      if (hint)     hint.textContent = "✓ Lectura completada";

      await escribirLog("ocr_usado", `Procesó imagen OCR (${(file.size / 1024).toFixed(0)}KB)`);
      toast("Texto extraído con Google Vision ✓", "success");
    } catch (err) {
      await logError("ocr", err.message);
      if (hint) hint.textContent = "Error al leer la imagen";
      toast("Error OCR: " + err.message, "error");
    } finally {
      unlock();
    }
  });

  limpiarBtn?.addEventListener("click", () => {
    if (fileInput)  fileInput.value = "";
    const preview = $("ocrPreview");
    if (preview)  { preview.src = ""; preview.style.display = "none"; }
    const textarea = $("ocrTexto");
    if (textarea)  textarea.value = "";
    const hint = $("ocrHint");
    if (hint)      hint.textContent = "";
  });

  usarBtn?.addEventListener("click", () => {
    const texto = $("ocrTexto")?.value.trim();
    if (!texto) { toast("No hay texto OCR para usar", "warn"); return; }
    if (typeof _onTextCallback === "function") _onTextCallback(texto);
    const medidas = $("medidas");
    if (medidas) {
      medidas.value = texto;
      toast("Medidas copiadas al cotizador ✓", "success");
    } else {
      toast("Copia el texto manualmente al campo de medidas", "info");
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

// 🔴 Llama a la Netlify Function que tiene la API key de Google Vision
// Variable de entorno requerida: GOOGLE_VISION_KEY
async function _llamarGoogleVision(base64Image) {
  try {
    const res = await fetch("/.netlify/functions/ocr", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ image: base64Image }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `Error ${res.status}`);
    }

    const data = await res.json();
    return data.text || "Sin texto detectado en la imagen";

  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("404")) {
      throw new Error(
        "Función OCR no disponible en localhost. " +
        "Sube el proyecto a Netlify y prueba desde la URL real."
      );
    }
    throw err;
  }
}

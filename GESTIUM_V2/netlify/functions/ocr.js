// ═══════════════════════════════════════════════════════
//  GESTIUM · Netlify Function: OCR Seguro
//  ✅ Valida token Firebase ID
//  ✅ Controla límite de uso por plan (Premium: 15/mes)
//  ✅ Registra uso en Firestore
//  Variables requeridas: GOOGLE_VISION_KEY, FIREBASE_PROJECT_ID, FIREBASE_API_KEY
// ═══════════════════════════════════════════════════════

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

// Planes y sus límites OCR mensuales
const OCR_LIMITS = {
  trial:        0,
  basico:       0,
  premium:      15,   // 15 usos/mes
  superpremium: 999,  // ilimitado efectivo
  superadmin:   9999,
};

export async function handler(event) {
  // ── Solo POST ──
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // ── Variables de entorno ──
  const VISION_KEY       = process.env.GOOGLE_VISION_KEY;
  const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || "gestium-2d40b";
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

  if (!VISION_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "GOOGLE_VISION_KEY no configurada" }) };
  }

  // ── Verificar token Firebase ──
  const authHeader = event.headers["authorization"] || event.headers["Authorization"] || "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: "Autenticación requerida" }) };
  }

  // Verificar token con Firebase Auth REST API (no necesita admin SDK)
  let uid;
  let userEmail;
  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) throw new Error("Token inválido");
    const verifyData = await verifyRes.json();
    if (!verifyData.users || !verifyData.users[0]) throw new Error("Usuario no encontrado");
    uid       = verifyData.users[0].localId;
    userEmail = verifyData.users[0].email;
  } catch (err) {
    return { statusCode: 401, body: JSON.stringify({ error: "Token inválido o expirado" }) };
  }

  // ── Leer datos del usuario desde Firestore REST ──
  let empresaId, plan, ocrUsadoMes;
  try {
    // 1. Leer usuariosMeta para obtener empresaId
    const metaUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/usuariosMeta/${uid}`;
    const metaRes = await fetch(metaUrl, {
      headers: { "Authorization": `Bearer ${idToken}` }
    });
    if (!metaRes.ok) throw new Error("No se encontró meta del usuario");
    const metaDoc = await metaRes.json();
    empresaId = metaDoc.fields?.empresaId?.stringValue;
    if (!empresaId) throw new Error("Sin empresa asignada");

    // 2. Leer datos de la empresa para obtener plan
    const empUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/empresas/${empresaId}`;
    const empRes = await fetch(empUrl, {
      headers: { "Authorization": `Bearer ${idToken}` }
    });
    if (!empRes.ok) throw new Error("Empresa no encontrada");
    const empDoc = await empRes.json();
    plan = empDoc.fields?.plan?.stringValue || "trial";
    
    // ✅ FIX: Validar empresa activa y no vencida
    const empresaActiva = empDoc.fields?.activa?.booleanValue;
    if (empresaActiva === false) {
      return { statusCode: 403, body: JSON.stringify({ error: "Empresa suspendida. Contacta al soporte." }) };
    }
    const fechaVencStr = empDoc.fields?.fechaVencimiento?.timestampValue;
    if (fechaVencStr) {
      const fechaVenc = new Date(fechaVencStr);
      if (fechaVenc < new Date()) {
        return { statusCode: 403, body: JSON.stringify({ error: "Plan vencido. Renueva para continuar usando OCR." }) };
      }
    }

    // 3. Leer conteo de uso OCR del mes actual
    const now  = new Date();
    const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const ocrCountUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/empresas/${empresaId}/ocrUsage/${mesKey}`;
    const ocrCountRes = await fetch(ocrCountUrl, {
      headers: { "Authorization": `Bearer ${idToken}` }
    });
    ocrUsadoMes = 0;
    if (ocrCountRes.ok) {
      const ocrDoc = await ocrCountRes.json();
      ocrUsadoMes = ocrDoc.fields?.count?.integerValue || ocrDoc.fields?.count?.doubleValue || 0;
      ocrUsadoMes = parseInt(ocrUsadoMes, 10);
    }
  } catch (err) {
    return { statusCode: 403, body: JSON.stringify({ error: "Error verificando acceso: " + err.message }) };
  }

  // ── Verificar que el plan permite OCR ──
  const limite = OCR_LIMITS[plan] ?? 0;
  if (limite === 0) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: `Tu plan (${plan}) no incluye OCR. Requiere Plan Premium o SuperPremium.`,
        plan,
        requiere: "premium"
      })
    };
  }

  // ── Verificar límite mensual ──
  if (ocrUsadoMes >= limite) {
    return {
      statusCode: 429,
      body: JSON.stringify({
        error: `Límite OCR alcanzado: ${ocrUsadoMes}/${limite} este mes. Renueva el mes que viene o actualiza a SuperPremium.`,
        usado: ocrUsadoMes,
        limite,
        plan
      })
    };
  }

  // ── Leer imagen del body ──
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Body inválido" }) };
  }

  const { image } = body;
  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: "Imagen requerida" }) };
  }

  const sizeBytes = Buffer.byteLength(image, "base64");
  if (sizeBytes > MAX_SIZE_BYTES) {
    return { statusCode: 400, body: JSON.stringify({ error: "Imagen supera 4MB" }) };
  }

  // ── Llamar Google Vision ──
  let textoExtraido;
  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: "TEXT_DETECTION" }]
          }]
        })
      }
    );

    if (!visionRes.ok) {
      const err = await visionRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: `Google Vision error: ${err.slice(0, 200)}` }) };
    }

    const visionData = await visionRes.json();
    textoExtraido = visionData.responses?.[0]?.fullTextAnnotation?.text || "";
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Error Vision: " + err.message }) };
  }

  // ── Incrementar contador de uso (Firestore REST) ──
  // ✅ FIX: Re-leer contador justo antes de escribir para minimizar race condition
  // (solución óptima sin Admin SDK; para atomicidad real usar Cloud Functions)
  try {
    const now    = new Date();
    const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const ocrCountUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/empresas/${empresaId}/ocrUsage/${mesKey}`;

    // Re-leer el contador actual para minimizar pérdidas por concurrencia
    let contadorActual = ocrUsadoMes;
    try {
      const reReadRes = await fetch(ocrCountUrl, {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      if (reReadRes.ok) {
        const reReadDoc = await reReadRes.json();
        const reReadCount = reReadDoc.fields?.count?.integerValue || reReadDoc.fields?.count?.doubleValue || 0;
        contadorActual = Math.max(ocrUsadoMes, parseInt(reReadCount, 10));
      }
    } catch (_) { /* usar ocrUsadoMes como fallback */ }

    await fetch(ocrCountUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          count: { integerValue: String(contadorActual + 1) },
          mes: { stringValue: mesKey },
          ultimoUso: { timestampValue: now.toISOString() },
          empresaId: { stringValue: empresaId },
          uid: { stringValue: uid }
        }
      })
    });
  } catch (err) {
    // No bloquear si falla el contador — el usuario ya pagó
    console.error("Error actualizando contador OCR:", err.message);
  }

  // ── Respuesta exitosa ──
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text:    textoExtraido,
      usado:   ocrUsadoMes + 1,
      limite,
      restante: limite - (ocrUsadoMes + 1),
      plan
    })
  };
}

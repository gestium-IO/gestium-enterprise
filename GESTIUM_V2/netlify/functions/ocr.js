// ═══════════════════════════════════════════════════════
//  GESTIUM · Netlify Function: OCR (Google Vision)
//  Variable requerida en Netlify: GOOGLE_VISION_KEY
// ═══════════════════════════════════════════════════════

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const VISION_KEY = process.env.GOOGLE_VISION_KEY;
  if (!VISION_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GOOGLE_VISION_KEY no configurada en Netlify Environment Variables" })
    };
  }

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
    return { statusCode: 400, body: JSON.stringify({ error: "Imagen supera 4MB. Comprime la imagen." }) };
  }

  try {
    const res = await fetch(
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

    if (!res.ok) {
      const err = await res.text();
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Google Vision error ${res.status}: ${err.slice(0, 300)}` })
      };
    }

    const data = await res.json();
    const text = data.responses?.[0]?.fullTextAnnotation?.text || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno: " + err.message })
    };
  }
}

# GESTIUM · CAMBIOS APLICADOS EN ESTA REVISIÓN

## ✅ CORRECCIONES DE CONTACTO

| Antes | Después |
|-------|---------|
| gestium.inteligencia@gmail.com | gestium.inteligencia@gmail.com |
| soporte@gestium.app | gestium.inteligencia@gmail.com |

Correo actualizado en:
- `html/index.html` (login + sidebar)
- `html/landing.html` (footer)
- `js/` (ninguna referencia directa encontrada)
- `docs/README_MASTER.md`
- `docs/MANUAL_ONBOARDING_COMPLETO.md`
- `docs/GUIA_DEPLOYMENT_COMPLETA.md`

---

## ✅ REDES SOCIALES AGREGADAS

Nombre en todas las redes: **Gestium Inteligencia Operativa**

Aparecen en:
- `html/index.html` → Login screen (debajo de botones contacto)
- `html/index.html` → Sidebar (sección ayuda)
- `html/landing.html` → Footer
- `docs/README_MASTER.md` → Sección contacto
- `docs/MANUAL_ONBOARDING_COMPLETO.md` → Sección recursos
- `docs/GUIA_DEPLOYMENT_COMPLETA.md` → Firma emails

Links configurados:
- 📘 Facebook: https://www.facebook.com/GestiumInteligenciaOperativa
- 📸 Instagram: https://www.instagram.com/GestiumInteligenciaOperativa
- 💼 LinkedIn: https://www.linkedin.com/company/GestiumInteligenciaOperativa

> ⚠️ Si los URLs exactos de tus perfiles son distintos, actualízalos en los 3 archivos HTML.

---

## ✅ CORRECCIÓN ARQUITECTURAL CRÍTICA — MULTIEMPRESA

### Problema detectado
`auth.js` guardaba usuarios en colección **global** `Usuarios/{uid}` pero las reglas Firestore usan **subcolección** `empresas/{empresaId}/usuarios/{uid}`.

Esta inconsistencia causaría que los usuarios creados no pudieran autenticarse correctamente en producción.

### Solución aplicada

**auth.js — Registro:**
```js
// ANTES (incorrecto — colección global)
await setDoc(doc(db, "Usuarios", user.uid), { ... });

// DESPUÉS (correcto — subcolección multiempresa)
await setDoc(doc(db, "empresas", empId, "usuarios", user.uid), { ... });
await setDoc(doc(db, "usuariosMeta", user.uid), { empresaId: empId, ... });
```

**auth.js — Login (initAuthState):**
- Ahora lee de `empresas/{id}/usuarios/{uid}` (subcolección correcta)
- Usa `usuariosMeta/{uid}` como índice ligero para encontrar el empresaId
- Cachea empresaId en localStorage para logins subsiguientes (no crítico)

**firestore_production.rules:**
- Agregada regla para colección `usuariosMeta`
- Solo el propio usuario puede leer/escribir su meta
- Nunca eliminable

**superadmin.js:**
```js
// ANTES (incorrecto)
query(collection(db,"Usuarios"), where("empresaId","==",e.id))

// DESPUÉS (correcto)
collection(db,"empresas",e.id,"usuarios")
```

---

## ✅ CORRECCIÓN DE PRECIOS — MRR_PLANS

**features.js:**

| Plan | Antes (incorrecto) | Después (correcto) |
|------|-------------------|-------------------|
| Básico | $29.000 | $65.000 COP |
| Premium | $89.000 | $119.000 COP |
| SuperPremium | $189.000 | $229.000 COP |

Los precios del panel superadmin (MRR) ahora reflejan los precios reales.

---

## ✅ CORRECCIÓN — fechaVencimiento vs vencimiento

Las reglas Firestore usan `fechaVencimiento` pero el registro creaba `vencimiento`.

**auth.js — Registro de empresa:**
```js
// Ahora se guardan AMBOS para compatibilidad:
fechaVencimiento: Timestamp.fromDate(trial),  // para reglas Firestore
vencimiento: Timestamp.fromDate(trial),        // compatibilidad
```

**auth.js — initAuthState:**
```js
// Lee cualquiera de los dos:
const fechaVenc = empresaData.fechaVencimiento || empresaData.vencimiento;
```

---

## ✅ LANDING.HTML — Footer corregido

- Removido link con email ofuscado (era ilegible)
- Agregado link directo `mailto:gestium.inteligencia@gmail.com`
- Agregados links a redes sociales

---

## 📋 ESTRUCTURA DE CARPETAS ENTREGADA

```
GESTIUM_COMPLETO/
├── html/
│   ├── index.html          ← App principal (login + registro + app)
│   ├── app.html            ← Redirección / suspensión
│   ├── landing.html        ← Landing page de venta
│   └── basico.html         ← Página plan básico
├── js/
│   ├── auth.js             ← ✅ CORREGIDO — multiempresa
│   ├── features.js         ← ✅ CORREGIDO — precios MRR
│   ├── contabilidad.js     ← Módulo SuperPremium
│   ├── cotizaciones.js     ← Cotizaciones
│   ├── dashboard.js        ← KPIs y métricas
│   ├── firebase.js         ← Config Firebase
│   ├── invitaciones.js     ← Sistema invitaciones
│   └── superadmin.js       ← ✅ CORREGIDO — subcollection
├── reglas/
│   ├── firestore_production.rules  ← ✅ ACTUALIZADO — usuariosMeta
│   └── netlify.toml               ← Config deploy
└── docs/
    ├── README_MASTER.md            ← ✅ Email + redes actualizadas
    ├── MANUAL_ONBOARDING_COMPLETO.md ← ✅ Email + redes actualizadas
    ├── GUIA_DEPLOYMENT_COMPLETA.md   ← ✅ Email + firma actualizadas
    ├── ROADMAP_5_ANOS.md             ← Sin cambios
    └── CAMBIOS_APLICADOS.md          ← Este archivo
```

---

## ⚠️ PASOS IMPORTANTES PARA EL DEPLOY

1. **Subir `reglas/firestore_production.rules` a Firebase Console**
   - Firebase Console → Firestore → Rules → Pegar → Publicar

2. **Verificar que la estructura coincida en GitHub**
   - Los HTML deben importar los JS con rutas correctas (revisar `import` en index.html)

3. **Actualizar URLs de redes sociales si son distintas**
   - Buscar `GestiumInteligenciaOperativa` en los 3 HTML y actualizar

4. **Netlify: configurar variables de entorno**
   - `VITE_GEMINI_KEY` o la key de OCR que uses

---

*Revisión aplicada: Febrero 2025 · Gestium Inteligencia Operativa*

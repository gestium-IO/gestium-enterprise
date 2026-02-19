# 🚀 GESTIUM · GUÍA COMPLETA DE PUESTA EN MARCHA
## Desde cero hasta el primer cliente — Paso a paso

---

## ⚡ RESUMEN RÁPIDO (si ya tienes Firebase y GitHub)

```
1. Sube el código a GitHub
2. Conecta GitHub con Netlify
3. Agrega GOOGLE_VISION_KEY en Netlify → Environment Variables
4. Publica las reglas en Firebase Console
5. Listo → prueba en la URL de Netlify
```

---

## PASO 1 — CONFIGURA FIREBASE (30 minutos)

### 1.1 Crear proyecto Firebase

```
→ Ir a: https://console.firebase.google.com
→ Clic "Agregar proyecto"
→ Nombre: gestium-produccion
→ Desactivar Google Analytics (no es necesario)
→ Clic "Crear proyecto"
```

### 1.2 Activar Authentication

```
→ Panel izquierdo → Authentication → Comenzar
→ Pestaña "Sign-in method"
→ Clic en "Correo electrónico/Contraseña"
→ Activar el primero (sin link mágico)
→ Guardar
```

### 1.3 Crear base de datos Firestore

```
→ Panel izquierdo → Firestore Database → Crear base de datos
→ Seleccionar: "Comenzar en modo de producción"
→ Ubicación: nam5 (us-central) ← la más económica
→ Finalizar
```

### 1.4 Publicar las REGLAS de Firestore 🔴 CRÍTICO

```
→ Firestore Database → pestaña "Reglas"
→ BORRAR todo lo que hay ahí
→ Copiar el contenido del archivo: reglas/firestore_production.rules
→ Pegar en el editor
→ Clic "Publicar"
```

⚠️ Sin esto, nadie puede registrarse ni iniciar sesión.

### 1.5 Obtener credenciales del proyecto

```
→ Ícono ⚙️ → Configuración del proyecto
→ Pestaña "General" → scroll abajo
→ Sección "Tus apps" → clic "</>  Web"
→ Nombre: gestium-web
→ NO activar Firebase Hosting
→ Clic "Registrar app"
→ Copiar el objeto firebaseConfig que aparece
```

El objeto se ve así:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "gestium-xxx.firebaseapp.com",
  projectId: "gestium-xxx",
  storageBucket: "gestium-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 1.6 Pegar credenciales en el código

```
→ Abrir: js/firebase.js
→ Buscar: const firebaseConfigPROD = {
→ Reemplazar con los valores de tu proyecto
→ Guardar
```

---

## PASO 2 — CREAR CUENTA SUPERADMIN (10 minutos)

Antes de subir a GitHub, necesitas crear tu usuario superadmin.

### 2.1 Registrarte en la app (en localhost)

```
→ Abrir index.html con Live Server en VS Code
→ Clic "Crear empresa"
→ Llenar tus datos personales
→ Nombre empresa: GESTIUM (o el nombre que quieras)
→ Registrarte
```

### 2.2 Obtener tu UID de Firebase

```
→ Firebase Console → Authentication → Users
→ Copiar el UID de tu usuario (columna "User UID")
→ Ejemplo: xK9pM2vL3nQr7tWs1YeA8bFdHjCu0Nv
```

### 2.3 Crear documento superadmin en Firestore

```
→ Firebase Console → Firestore Database
→ Clic "+ Iniciar colección"
→ ID de colección: superadmin
→ ID de documento: (pega tu UID exacto)
→ Agregar campo:
   - nombre: "Tu Nombre" (string)
   - email: "gestium.inteligencia@gmail.com" (string)
   - activo: true (boolean)
→ Guardar
```

### 2.4 Crear documento en subcolección de usuarios

```
→ Firestore → empresas → (tu empresaId) → usuarios → (tu UID)
→ Verificar que tiene:
   - rol: "admin"
   - activo: true
   - superadmin: true ← agregar este campo manualmente
→ Guardar
```

---

## PASO 3 — SUBIR A GITHUB (15 minutos)

### 3.1 Instalar Git (si no lo tienes)

```
→ Descargar desde: https://git-scm.com/download/win
→ Instalar con opciones por defecto
→ Reiniciar VS Code
```

### 3.2 Crear repositorio en GitHub

```
→ Ir a: https://github.com
→ Clic "+" → "New repository"
→ Nombre: gestium-saas
→ Privado (recomendado)
→ NO inicializar con README
→ Clic "Create repository"
→ Copiar la URL: https://github.com/TUUSUARIO/gestium-saas.git
```

### 3.3 Subir el código

Abrir terminal en VS Code (Ctrl + `) y escribir:

```bash
cd "C:\Documentos\SENA\GESTIUM 1.1\GESTIUM_FINAL"
git init
git add .
git commit -m "Primer commit - GESTIUM v1.0"
git branch -M main
git remote add origin https://github.com/TUUSUARIO/gestium-saas.git
git push -u origin main
```

✅ Si te pide usuario y contraseña de GitHub → usa tu usuario y un "Personal Access Token" (no tu contraseña normal).

Para crear el token:
```
GitHub → Settings → Developer settings → Personal access tokens
→ Tokens (classic) → Generate new token
→ Activar: repo
→ Copiar el token
```

---

## PASO 4 — DEPLOY EN NETLIFY (20 minutos)

### 4.1 Crear cuenta en Netlify

```
→ Ir a: https://www.netlify.com
→ "Sign up" → "Continue with GitHub"
→ Autorizar Netlify
```

### 4.2 Conectar repositorio

```
→ Netlify dashboard → "Add new site" → "Import an existing project"
→ Seleccionar: GitHub
→ Buscar y seleccionar: gestium-saas
→ Configuración de build:
   - Build command: (dejar VACÍO)
   - Publish directory: . (un punto)
   - Functions directory: netlify/functions
→ Clic "Deploy site"
```

### 4.3 Agregar variable GOOGLE_VISION_KEY 🔴 CRÍTICO PARA OCR

```
→ Netlify → tu sitio → Site settings
→ Panel izquierdo: "Environment variables"
→ Clic "Add a variable"
→ Key: GOOGLE_VISION_KEY
→ Value: (pega tu API key de Google Vision)
→ Guardar
→ Ir a: Deploys → "Trigger deploy" → "Deploy site"
```

⚠️ Las variables solo se leen en el momento del deploy. Si la agregas después, debes hacer nuevo deploy.

### 4.4 Obtener la API key de Google Vision

```
→ Ir a: https://console.cloud.google.com
→ Seleccionar tu proyecto (o crear uno nuevo)
→ Menú → APIs y Servicios → Credenciales
→ "+ Crear credencial" → "Clave de API"
→ Copiar la key
→ Clic en "Editar clave" → Restricciones de API
→ Seleccionar: Cloud Vision API
→ Guardar
```

Luego activar la API:
```
→ APIs y Servicios → Biblioteca
→ Buscar: "Cloud Vision API"
→ Clic → Habilitar
```

### 4.5 Configurar dominio personalizado (opcional pero recomendado)

```
→ Netlify → tu sitio → Domain management
→ "Add a domain" → ingresar tu dominio
→ Seguir instrucciones para apuntar el DNS
```

O usar el dominio gratis de Netlify: `gestium-saas.netlify.app`

---

## PASO 5 — VERIFICACIÓN FINAL (10 minutos)

### Checklist antes de dar acceso a clientes:

```
□ Puedo iniciar sesión con mi correo
□ Veo el panel de superadmin al iniciar sesión
□ Puedo crear una nueva empresa (registro)
□ Las reglas Firestore están publicadas
□ Los chips del login se abren al hacer clic
□ El dashboard carga datos correctamente
□ Puedo crear una cotización y descargar el PDF
□ Los selects (listas desplegables) muestran texto visible
□ En Netlify, la variable GOOGLE_VISION_KEY está configurada
□ El OCR funciona desde la URL de Netlify (no desde localhost)
```

---

## PASO 6 — CREAR EL PRIMER CLIENTE (5 minutos)

### Como superadmin, dar acceso a un cliente:

**Opción A — Cliente se registra solo:**
```
→ Enviar al cliente la URL de tu Netlify
→ Clic "Crear empresa"
→ Llenar sus datos
→ Seleccionar plan Trial (7 días gratis)
→ Luego tú desde Superadmin cambias el plan
```

**Opción B — Tú creas la empresa:**
```
→ Panel Superadmin → (no disponible directo)
→ Usa Firestore Console para crear la empresa
   o registra tú mismo con los datos del cliente
```

**Cambiar plan desde Superadmin:**
```
→ Iniciar sesión con tu cuenta superadmin
→ Módulo "Superadmin" en el sidebar
→ Buscar la empresa del cliente
→ Menú "Acción..." → Seleccionar plan
→ Extender vencimiento si es necesario
```

---

## ERRORES COMUNES Y SOLUCIONES

### ❌ "Missing or insufficient permissions"
```
Causa: Las reglas Firestore no están publicadas correctamente.
Solución:
→ Firebase Console → Firestore → Rules
→ Copiar reglas desde reglas/firestore_production.rules
→ Publicar
→ Esperar 1-2 minutos y recargar
```

### ❌ "The query requires an index"
```
Causa: Firestore necesita índices para queries con múltiples filtros.
Solución:
→ La consola te da un link directo
→ Clic en el link
→ "Crear índice"
→ Esperar 2-5 minutos
→ Puede aparecer más de uno — créalos todos
```

### ❌ OCR devuelve error 404 en localhost
```
Causa: Las Netlify Functions no corren en localhost por defecto.
Solución: El OCR solo funciona desde la URL de Netlify.
→ Sube el código
→ Prueba desde https://tu-sitio.netlify.app
```

### ❌ OCR devuelve "GOOGLE_VISION_KEY no configurada"
```
Causa: La variable no está en Netlify o hay error en el nombre.
Solución:
→ Netlify → Site settings → Environment variables
→ Verificar que se llame EXACTAMENTE: GOOGLE_VISION_KEY
→ Hacer nuevo deploy
```

### ❌ Selects con texto blanco sobre blanco
```
Causa: CSS del navegador que sobreescribe el estilo oscuro.
Solución: Ya está corregido en esta versión.
Si persiste → Ctrl+Shift+R (hard refresh) en el navegador.
```

### ❌ Usuario no puede iniciar sesión tras registrarse
```
Causa: El documento en la subcolección usuarios no se creó.
Solución:
→ Firebase Console → Firestore
→ empresas → (empresaId) → usuarios
→ Verificar que exista un documento con el UID del usuario
→ Debe tener: activo: true, rol: "admin"
```

### ❌ No aparece el módulo Superadmin en el sidebar
```
Causa: El documento superadmin/{uid} no existe en Firestore.
Solución: Ver Paso 2.3 de esta guía.
```

---

## FLUJO DE COBRO A CLIENTES

```
1. Cliente se registra → Trial 7 días automático
2. A los 5 días → Mensaje por WhatsApp: "Tu trial vence en 2 días"
3. Cliente paga (Nequi, Bancolombia, efectivo)
4. Tú vas a Superadmin → cambias plan + extiendes 30/90 días
5. Cliente sigue usando sin interrupción
```

**Precios:**
- Plan Básico: $65.000 COP/mes
- Plan Premium: $119.000 COP/mes
- Plan SuperPremium: $229.000 COP/mes

**Contacto para soporte:**
- WhatsApp: +57 300 554 1411
- Email: gestium.inteligencia@gmail.com
- Facebook/Instagram/LinkedIn: Gestium Inteligencia Operativa

---

*GESTIUM · Inteligencia Operativa · v1.0*

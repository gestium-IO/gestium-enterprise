# 🚀 GUÍA DEPLOYMENT COMPLETO · CERO A PRIMER CLIENTE

**De archivos en tu PC → Cliente pagando en producción**

Tiempo estimado: **2-3 horas** (primera vez)

---

## 📋 ÍNDICE

1. [Pre-requisitos](#paso-0-pre-requisitos)
2. [Configurar Firebase](#paso-1-firebase-setup-30-min)
3. [Configurar GitHub](#paso-2-github-repository-15-min)
4. [Deploy en Netlify](#paso-3-netlify-deployment-20-min)
5. [Configurar Superadmin](#paso-4-superadmin-setup-10-min)
6. [Testing Completo](#paso-5-testing-30-min)
7. [Primer Cliente](#paso-6-primer-cliente-real)
8. [Monitoreo](#paso-7-monitoreo-continuo)

---

## PASO 0: PRE-REQUISITOS

### Cuentas Necesarias (Todas Gratuitas)

```
✅ Gmail (para todo)
✅ GitHub (código fuente)
✅ Firebase (base de datos)
✅ Netlify (hosting)
✅ Google Cloud (OCR - opcional)
```

### En Tu Computador

```bash
# Verificar instalaciones
node --version   # v18+ requerido
git --version    # cualquier versión reciente

# Si no tienes Node.js:
# Descargar de: https://nodejs.org
```

---

## PASO 1: FIREBASE SETUP (30 min)

### 1.1 Crear Proyecto Firebase

```
1. Ir a: https://console.firebase.google.com
2. Click "Agregar proyecto"
3. Nombre: "gestium-produccion"
4. Google Analytics: SÍ (activar)
5. Cuenta: Default
6. Click "Crear proyecto"
```

### 1.2 Configurar Authentication

```
1. En el menú lateral → Authentication
2. Click "Comenzar"
3. Método de acceso → Email/Contraseña
4. Activar "Email/Contraseña"
5. Activar "Vínculos de correo electrónico" (opcional)
6. Guardar
```

### 1.3 Crear Firestore Database

```
1. En el menú lateral → Firestore Database
2. Click "Crear base de datos"
3. Modo: PRODUCCIÓN
4. Ubicación: us-east1 (o más cercana a Colombia)
5. Click "Habilitar"

⚠️ IMPORTANTE: Las reglas se publican después
```

### 1.4 Copiar Credenciales Firebase

```
1. Ir a: Configuración proyecto (⚙️ arriba izquierda)
2. Sección "Tus apps"
3. Click "</>" (Web app)
4. Nombre: "GESTIUM Web"
5. ✅ También configurar Firebase Hosting
6. Click "Registrar app"

7. COPIAR EXACTAMENTE:
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "gestium-produccion.firebaseapp.com",
     projectId: "gestium-produccion",
     storageBucket: "gestium-produccion.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:..."
   };

8. Guardar en archivo temporal (lo usaremos)
```

### 1.5 Publicar Reglas Firestore

```
1. Firestore Database → Rules (pestaña superior)

2. BORRAR TODO el contenido actual

3. COPIAR EXACTAMENTE el archivo:
   firestore_production.rules
   (el que te entregué)

4. Click "Publicar"

⚠️ Si da error de sintaxis, revisar que copiaste TODO completo
```

### 1.6 Verificar Reglas Publicadas

```
1. Reglas → Pestaña "Rules"
2. Debe aparecer fecha de publicación reciente
3. Buscar texto: "multiempresa" 
   → Si aparece, está correcto ✅
```

---

## PASO 2: GITHUB REPOSITORY (15 min)

### 2.1 Crear Repositorio

```
1. Ir a: https://github.com
2. Click "New repository" (verde)
3. Nombre: "gestium-app"
4. Descripción: "GESTIUM · Sistema SaaS ERP"
5. ✅ Private (recomendado)
6. NO inicializar con README
7. Click "Create repository"
```

### 2.2 Configurar Firebase en el Código

```bash
# En tu computador, abrir:
# VERIFICACION/js/firebase.js

# REEMPLAZAR las credenciales con las de TU proyecto:

const firebaseConfig = {
  apiKey: "AIzaSy...",              ← TUS CREDENCIALES
  authDomain: "gestium-produccion.firebaseapp.com",
  projectId: "gestium-produccion",
  // ... etc
};
```

### 2.3 Subir Código a GitHub

```bash
# Abrir terminal en carpeta VERIFICACION/

# Inicializar Git
git init

# Agregar todos los archivos
git add .

# Primer commit
git commit -m "GESTIUM v1.0 - Sistema Producción"

# Conectar con GitHub (reemplaza TU-USUARIO)
git branch -M main
git remote add origin https://github.com/TU-USUARIO/gestium-app.git

# Subir código
git push -u origin main
```

### 2.4 Verificar en GitHub

```
1. Refrescar tu repositorio en GitHub
2. Debes ver todos los archivos:
   ✅ index.html
   ✅ app.html
   ✅ landing.html
   ✅ js/ (carpeta con todos los módulos)
   ✅ firestore.rules
   ✅ netlify.toml
```

---

## PASO 3: NETLIFY DEPLOYMENT (20 min)

### 3.1 Conectar Netlify con GitHub

```
1. Ir a: https://app.netlify.com
2. Login con GitHub (recomendado)
3. Click "Add new site" → "Import from Git"
4. Click "GitHub"
5. Autorizar Netlify en GitHub
6. Seleccionar repositorio: "gestium-app"
```

### 3.2 Configurar Build Settings

```
Build settings:
┌─────────────────────────────────────┐
│ Branch to deploy: main              │
│ Base directory:   (dejar vacío)     │
│ Build command:    (dejar vacío)     │
│ Publish directory: .                │
│ Functions directory: netlify/functions │
└─────────────────────────────────────┘

Click "Deploy site"
```

### 3.3 Esperar Deploy Inicial

```
⏳ Netlify está deployando...

1. Ver progreso en: Deploy log
2. Esperar "Site is live" ✅
3. Copiar URL: 
   https://random-name-12345.netlify.app
```

### 3.4 Configurar Dominio Personalizado (Opcional)

```
1. Site settings → Domain management
2. Add custom domain
3. Ingresar: gestium.app (o tu dominio)
4. Seguir pasos de verificación DNS
5. Netlify configura SSL automático
```

### 3.5 Configurar Variables de Entorno

```
1. Site settings → Environment variables
2. Click "Add a variable"

Variable 1:
┌─────────────────────────────────────┐
│ Key:   GOOGLE_VISION_API_KEY        │
│ Value: AIzaSy... (tu key de Vision)│
│ Scopes: ✅ All scopes               │
└─────────────────────────────────────┘

Variable 2 (opcional - si usas Sentry):
┌─────────────────────────────────────┐
│ Key:   SENTRY_DSN                   │
│ Value: https://...                  │
└─────────────────────────────────────┘

3. Click "Save"
4. Ir a: Deploys → Trigger deploy → Deploy site
   (para que tome las variables)
```

### 3.6 Configurar Redirects

```
Ya está configurado en netlify.toml ✅

Verifica que exista:
┌─────────────────────────────────────┐
│ /           →  /index.html          │
│ /app        →  /app.html            │
│ /landing    →  /landing.html        │
│ /basico     →  /basico.html         │
└─────────────────────────────────────┘
```

---

## PASO 4: SUPERADMIN SETUP (10 min)

### 4.1 Registrar Primera Cuenta

```
1. Ir a: https://tu-sitio.netlify.app
2. Click "Crear cuenta"
3. Llenar formulario CON TUS DATOS REALES:
   ┌────────────────────────────────────┐
   │ Email:      gestium.inteligencia@gmail.com │
   │ Nombre:     José Arboleda          │
   │ Empresa:    GESTIUM Administración │
   │ Contraseña: ********               │
   └────────────────────────────────────┘
4. Completar registro
```

### 4.2 Obtener Tu UID de Firebase

```
1. Firebase Console → Authentication
2. Buscar tu email en la lista de usuarios
3. Click en tu usuario
4. COPIAR el "User UID"
   Ejemplo: "abc123xyz456..."
```

### 4.3 Activar Superadmin en Firestore

```
1. Firebase Console → Firestore Database
2. Click "Iniciar colección"
3. ID de colección: "superadmin"
4. Click "Siguiente"

5. ID de documento: [PEGAR TU UID AQUÍ]
6. Agregar campos:
   ┌────────────────────────────────────┐
   │ activo:   true      (boolean)      │
   │ nombre:   "José Arboleda" (string) │
   │ email:    "tu@email.com"  (string) │
   └────────────────────────────────────┘

7. Guardar
```

### 4.4 Verificar Acceso Superadmin

```
1. Recargar tu app (F5)
2. Login con tu cuenta
3. Debes ver en el sidebar:
   ✅ "SUPERADMIN" badge
   ✅ Módulo "SuperAdmin" visible
4. Click en SuperAdmin
5. Debes ver dashboard de métricas
```

---

## PASO 5: TESTING COMPLETO (30 min)

### Test 1: Registro de Nueva Empresa

```
✅ TODO ESTO DEBE FUNCIONAR:

1. Abrir en ventana incógnito
2. Ir a tu sitio
3. Click "Crear cuenta"
4. Llenar formulario empresa de prueba
5. Enviar
6. Debe redirigir a dashboard ✅
7. Verificar en Firestore:
   empresas/{empresaId} existe
   empresas/{empresaId}/usuarios/{uid} existe
```

### Test 2: Crear Cotización

```
1. Dashboard → Cotizaciones
2. Crear cliente: "Cliente Test"
3. Llenar medidas: "2-180*100"
4. Altura: 38
5. Precio: 235000
6. Generar PDF
7. Debe descargar COT-001.pdf ✅
```

### Test 3: Control de Planes

```
1. Empresa de prueba tiene plan "trial"
2. Intentar acceder a "Finanzas"
3. Debe mostrar: "🔒 Módulo No Disponible" ✅
4. Como Superadmin, cambiar plan a "premium"
5. Recargar
6. Ahora SÍ debe ver "Finanzas" ✅
```

### Test 4: Invitación de Usuario

```
1. Dashboard → Usuarios
2. Click "Invitar usuario"
3. Email: otro@email.com
4. Rol: "vendedor"
5. Enviar
6. Verificar en Firestore:
   empresas/{id}/invitaciones/{invId} existe
   con token y expiraEn
```

### Test 5: Doble Partida Contable

```
(Solo si plan SuperPremium)

1. Contabilidad → Crear asiento manual
2. Línea 1: Débito $100.000
3. Línea 2: Crédito $50.000  ← DESCUADRADO
4. Intentar guardar
5. Debe rechazar: "Asiento descuadrado" ✅
6. Corregir: Línea 2 = $100.000
7. Ahora SÍ debe guardar ✅
```

### Test 6: Empresa Vencida

```
1. Como Superadmin, seleccionar empresa prueba
2. Cambiar fechaVencimiento a ayer
3. Usuario de esa empresa intenta login
4. Debe ver: "Plan vencido" ✅
5. No puede acceder a módulos
```

### Test 7: Responsive Móvil

```
1. Abrir en móvil (o DevTools → modo móvil)
2. Menú hamburguesa funciona ✅
3. Sidebar deslizable ✅
4. Tablas con scroll horizontal ✅
5. Formularios usables ✅
6. Botones tamaño adecuado ✅
```

---

## PASO 6: PRIMER CLIENTE REAL

### 6.1 Preparación Comercial

```
ANTES de contactar clientes:

□ Dominio propio configurado (gestium.app)
□ Email profesional (contacto@gestium.app)
□ WhatsApp Business configurado
□ Precios claros y definidos
□ Landing page pulida
□ Manual de usuario listo
□ Videos demo grabados (opcional)
□ Términos y condiciones publicados
□ Política de privacidad publicada
```

### 6.2 Prospección

```
PERFIL IDEAL:
- Madereras / Ferreterías
- Constructoras pequeñas/medianas
- Fabricantes de muebles
- Distribuidores de materiales
- 5-20 empleados
- Facturación: $50M-500M COP/mes

CANALES:
1. LinkedIn (publicar caso de uso)
2. WhatsApp Business (contactos directos)
3. Google Ads local (Medellín)
4. Referidos (ofrecer comisión)
```

### 6.3 Demo al Cliente

```
SCRIPT DE DEMO (15 minutos):

1. PROBLEMA (2 min)
   "¿Cómo cotiza actualmente?"
   "¿Usa Excel? ¿Cuánto demora?"

2. SOLUCIÓN (5 min)
   Demo en vivo:
   - Crear cliente
   - Generar cotización
   - PDF descargado
   "Todo en 2 minutos vs 20 en Excel"

3. VALOR (3 min)
   - Dashboard en tiempo real
   - Sin errores de cálculo
   - Control de ventas
   - Multi-usuario

4. PLANES (3 min)
   Básico: "Empieza aquí"
   Premium: "Para crecer"
   SuperPremium: "Para contabilidad seria"

5. CIERRE (2 min)
   "7 días gratis, sin tarjeta"
   "¿Empezamos ahora?"
```

### 6.4 Onboarding del Cliente

```
DÍA 1: REGISTRO
├─ Cliente se registra
├─ Email de bienvenida automático
├─ Tú verificas datos en Firestore
└─ WhatsApp: "¿Necesitas ayuda?"

DÍA 2-3: ACOMPAÑAMIENTO
├─ Videollamada 30 min
├─ Ayudas a crear primeros clientes
├─ Generar primera cotización real
└─ Resolver dudas

DÍA 4-6: MONITOREO
├─ Revisar actividad en Firestore
├─ ¿Está usando el sistema?
├─ Si no → llamar y ayudar
└─ Si sí → felicitar y preguntar qué falta

DÍA 7: CONVERSIÓN
├─ Recordatorio: "Trial termina mañana"
├─ Ofrecer descuento primer mes (opcional)
├─ Enviar info de pago
└─ Activar plan pagado
```

### 6.5 Cobro Primer Pago

```
MÉTODOS RECOMENDADOS (Colombia):

1. TRANSFERENCIA BANCARIA
   ┌────────────────────────────────┐
   │ Tu banco: Bancolombia/Nequi    │
   │ Cliente transfiere             │
   │ Envía comprobante              │
   │ Tú verificas y extiendes plan  │
   └────────────────────────────────┘

2. PSE (requiere integración)
   - Costo setup: ~$200k COP
   - Comisión: 2.5-3% por transacción
   - Ideal para: >10 clientes/mes

3. LINK DE PAGO (MercadoPago/Wompi)
   - Gratis setup
   - Comisión: 3.5-4%
   - Manual al inicio
```

### 6.6 Extender Plan Pagado

```
Cliente envió comprobante de pago:

1. COMO SUPERADMIN:
   Dashboard → Empresas
   Seleccionar empresa del cliente
   
2. Cambiar plan:
   ┌────────────────────────────────┐
   │ Plan Actual:  Trial            │
   │ Nuevo Plan:   Premium          │
   │ Vencimiento:  2026-03-20       │
   │               (+30 días)       │
   └────────────────────────────────┘
   
3. Guardar cambios
   
4. Verificar:
   ✅ Cliente puede acceder a módulos
   ✅ Fecha vencimiento correcta
   ✅ Plan visible en su dashboard

5. Registrar en tu control:
   Google Sheets / Notion:
   Cliente | Plan | Pagó | Vence | MRR
```

---

## PASO 7: MONITOREO CONTINUO

### 7.1 Métricas Diarias

```
REVISAR CADA MAÑANA (5 min):

□ Firebase Console → Authentication
  ¿Cuántos registros nuevos?
  
□ Firestore → empresas
  ¿Cuántas empresas activas?
  ¿Cuántas vencen esta semana?
  
□ Netlify → Analytics
  ¿Cuántas visitas?
  ¿Qué páginas más visitadas?
```

### 7.2 Dashboard Superadmin

```
TU VISTA CADA DÍA:

┌─────────────────────────────────────┐
│ 📊 MRR: $1,845,000 COP              │
│ 🏢 Empresas: 18                     │
│ 🎯 Trial: 4                         │
│ ⚠️ Vencen hoy: 2                    │
│ 💰 Conversión: 72%                  │
└─────────────────────────────────────┘

Acciones:
- Contactar empresas que vencen
- Seguimiento trials activos
- Resolver tickets soporte
```

### 7.3 Backup Semanal

```
CADA DOMINGO:

1. Firebase Console → Firestore
2. Export/Import tab
3. Export to Cloud Storage
4. Guardar backup local también

5. Alternativa: Script automático
   (configurar Cloud Functions)
```

### 7.4 Errores y Logs

```
MONITOREAR:

1. Firebase Console → Firestore → Logs
   ¿Errores de reglas?
   
2. Netlify → Functions → Logs
   ¿Errores en OCR?
   
3. Browser Console (tu testing)
   ¿Errores JS?

4. Configurar Sentry (opcional):
   Alertas automáticas por email
```

---

## CHECKLIST FINAL PRE-LANZAMIENTO

```
INFRAESTRUCTURA:
□ Firebase configurado y reglas publicadas
□ GitHub repositorio privado con código
□ Netlify deployado y funcionando
□ Dominio propio configurado (opcional)
□ SSL activo (automático en Netlify)
□ Variables entorno configuradas

FUNCIONALIDAD:
□ Registro de nuevas empresas funciona
□ Login funciona
□ Crear cotización funciona
□ PDF se genera y descarga
□ Dashboard muestra datos
□ Control de planes funciona
□ Invitaciones funcionan
□ Módulos se bloquean según plan

SEGURIDAD:
□ Reglas Firestore bloqueando correctamente
□ No hay errores en consola
□ Usuarios no pueden ver otras empresas
□ Superadmin funciona correctamente

NEGOCIO:
□ Precios definidos ($65k, $119k, $229k)
□ Landing page publicada
□ Manual de usuario listo
□ Método de cobro definido
□ WhatsApp Business activo
□ Email profesional configurado

LEGAL (recomendado):
□ Términos y condiciones publicados
□ Política de privacidad publicada
□ Aviso de cookies (si usas analytics)
```

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### "No puedo hacer login"

```
Causa 1: Reglas Firestore mal publicadas
└─ Solución: Republicar reglas exactamente

Causa 2: Usuario no existe en Firestore
└─ Solución: Verificar colección Usuarios o empresas/{id}/usuarios

Causa 3: Firebase config incorrecta
└─ Solución: Verificar firebase.js tiene TUS credenciales
```

### "Módulo Finanzas no se ve"

```
Causa: Plan no permite acceso
└─ Solución:
   1. Verificar plan en Firestore
   2. Debe ser "premium" o "superpremium"
   3. Reglas bloquean acceso si plan incorrecto
```

### "Superadmin no funciona"

```
Causa: Documento superadmin no existe
└─ Solución:
   1. Firestore → colección "superadmin"
   2. Documento con tu UID
   3. Campo activo: true
```

### "PDF no se genera"

```
Causa 1: jsPDF no cargó
└─ Solución: Verificar conexión CDN

Causa 2: Error en cálculo de medidas
└─ Solución: Revisar formato medidas (cant-ancho*largo)
```

---

## 📞 SOPORTE AL CLIENTE

### Template Respuesta Rápida

```
Hola [NOMBRE],

Gracias por contactarnos sobre [PROBLEMA].

Para ayudarte mejor, necesito:
1. Tu email registrado
2. Nombre de tu empresa en GESTIUM
3. Descripción del error (si aplica)

Mientras tanto, puedes revisar:
📚 Manual: gestium.app/manual
🎥 Videos: gestium.app/tutoriales

Te respondo en menos de 2 horas.

Saludos,
Gestium Inteligencia Operativa
WhatsApp: +57 300 554 1411
Email: gestium.inteligencia@gmail.com
Facebook/Instagram/LinkedIn: Gestium Inteligencia Operativa
```

---

## 🎯 PRÓXIMOS 30 DÍAS

### Semana 1-2: Primeros Clientes
```
Objetivo: 5 empresas en trial
Actividades:
- Demo a 15 prospectos
- Cerrar 5 trials
- Onboarding completo
```

### Semana 3: Conversión
```
Objetivo: 3 clientes pagando
Actividades:
- Seguimiento intensivo trials
- Resolver obstáculos
- Primera facturación
```

### Semana 4: Optimización
```
Objetivo: Mejorar producto
Actividades:
- Recopilar feedback
- Fix bugs críticos
- Mejorar onboarding
```

---

**¡LISTO PARA VENDER!** 🚀

Has completado el deployment profesional de GESTIUM.  
Ahora tienes un SaaS funcional, seguro y listo para escalar.

**Siguiente paso:** Contactar tu primer cliente potencial.


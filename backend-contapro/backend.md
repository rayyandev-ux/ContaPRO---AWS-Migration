# ContaPRO — Documentación Backend (Detalle Milimétrico)

> **Última actualización:** Marzo 2026
> **Stack:** Fastify v5 · Node.js (ESM) · TypeScript · Prisma ORM · PostgreSQL · Redis · BullMQ

---

## Tabla de Contenidos

1. [Visión General de la Arquitectura](#1-visión-general-de-la-arquitectura)
2. [Estructura de Directorios](#2-estructura-de-directorios)
3. [Configuración y Variables de Entorno](#3-configuración-y-variables-de-entorno)
4. [Punto de Entrada — `index.ts`](#4-punto-de-entrada--indexts)
5. [Base de Datos — Prisma Schema](#5-base-de-datos--prisma-schema)
6. [Sistema de Autenticación](#6-sistema-de-autenticación)
7. [Rutas y Endpoints](#7-rutas-y-endpoints)
8. [Servicios Core](#8-servicios-core)
9. [Sistema de IA y Procesamiento de Documentos](#9-sistema-de-ia-y-procesamiento-de-documentos)
10. [Integraciones de Mensajería](#10-integraciones-de-mensajería)
11. [Integración de Email (Gmail/Outlook)](#11-integración-de-email-gmailoutlook)
12. [Sistema de Pagos — Stripe](#12-sistema-de-pagos--stripe)
13. [Tareas en Segundo Plano — BullMQ & Cron](#13-tareas-en-segundo-plano--bullmq--cron)
14. [Utilidades](#14-utilidades)
15. [Despliegue — Docker](#15-despliegue--docker)
16. [Convenciones y Reglas de Oro](#16-convenciones-y-reglas-de-oro)

---

## 1. Visión General de la Arquitectura

ContaPRO es una plataforma de gestión financiera personal/empresarial con un backend **modular** basado en plugins de Fastify. La arquitectura sigue el patrón:

```
Cliente (Web/WhatsApp/Telegram)
        │
        ▼
   Fastify Server (index.ts)
   ├── Plugins (CORS, JWT, Cookie, Multipart, OAuth2, Swagger)
   ├── Rutas (auth, expenses, budget, chat, upload, payments, integrations...)
   ├── Servicios (OpenAI, Agent, Currency, Stripe, Telegram, WhatsApp, Email...)
   ├── Workers (BullMQ: emailScanner, analysisWorker)
   └── Prisma ORM → PostgreSQL
                    Redis (Colas, Caché)
```

### Principios Arquitectónicos

| Principio | Implementación |
|---|---|
| **Aislamiento Multi-Tenant** | Toda query Prisma filtra por `userId` AND `profileId` |
| **Modularidad** | Cada dominio es un plugin Fastify independiente |
| **Seguridad** | JWT en cookies HttpOnly, argon2 para passwords, tokens encriptados con AES-256-GCM |
| **Resiliencia** | Fallbacks en cascada para IA (Python LLM → Node Vision → OCR → Heurísticas) |
| **Caché inteligente** | `AiCache` en PostgreSQL con TTL para tasas de cambio y resultados de IA |

---

## 2. Estructura de Directorios

```
backend-contapro/
├── prisma/
│   └── schema.prisma          # Esquema completo de la base de datos
├── python/
│   ├── requirements.txt       # Dependencias Python (OCR, LLM)
│   ├── ocr_extract.py         # Script de OCR con Tesseract/EasyOCR
│   └── llm_extract.py         # Script de extracción con LLM local
├── src/
│   ├── index.ts               # Punto de entrada, bootstrap del servidor
│   ├── config.ts              # Configuración centralizada (env vars)
│   ├── routes/
│   │   ├── auth.ts            # Registro, Login, OAuth, Verificación, Reset
│   │   ├── expenses.ts        # CRUD de gastos, aprobación de pendientes
│   │   ├── budget.ts          # Presupuestos (general, categoría, método de pago)
│   │   ├── chat.ts            # Chat web con agente IA
│   │   ├── upload.ts          # Subida y procesamiento de documentos
│   │   ├── payments.ts        # Checkout y portal de Stripe
│   │   ├── stripe_webhook.ts  # Webhook de Stripe (evento separado)
│   │   ├── integrations.ts    # Telegram, WhatsApp, Gmail, Outlook
│   │   ├── profiles.ts        # Gestión de perfiles de usuario
│   │   ├── categories.ts      # CRUD de categorías
│   │   ├── savings.ts         # Metas de ahorro
│   │   └── documents.ts       # Proxy de documentos/previews
│   ├── services/
│   │   ├── openai.ts          # Extracción IA de documentos y NLP
│   │   ├── agent.ts           # Agente conversacional (function calling)
│   │   ├── conversation.ts    # Handler unificado de conversaciones
│   │   ├── currency.ts        # Conversión de monedas (API + caché)
│   │   ├── stripe.ts          # Cliente Stripe y resolución de Price IDs
│   │   ├── telegram.ts        # Bot de Telegram (polling)
│   │   ├── whatsapp.ts        # Integración WhatsApp (Wazend/Evolution API)
│   │   ├── email.ts           # Envío de correos transaccionales (Resend/SMTP)
│   │   ├── notifications.ts   # Servicio unificado de notificaciones
│   │   ├── profile-limits.ts  # Cálculo de límites de perfiles
│   │   ├── sales.ts           # Flujo de ventas para usuarios no registrados
│   │   ├── groq.ts            # Transcripción de audio y visión (Groq/Whisper)
│   │   ├── redis.ts           # Conexión Redis singleton
│   │   ├── queues.ts          # Inicialización de colas BullMQ
│   │   ├── tiktok.ts          # Pixel de TikTok (eventos server-side)
│   │   ├── image-generator.ts # Generación de imágenes para reportes diarios
│   │   ├── pythonOCR.ts       # Bridge Node→Python para OCR
│   │   └── pythonLLM.ts       # Bridge Node→Python para LLM
│   ├── workers/
│   │   └── emailScanner.ts    # Worker BullMQ para escaneo de emails
│   ├── jobs/
│   │   └── DailyReportJob.ts  # Cron job: reporte diario por WhatsApp
│   └── utils/
│       ├── auth.ts            # getCookieOpts, requireAuth
│       ├── jwt.ts             # Generación/verificación de tokens
│       ├── subscription.ts    # isPremium, isTrial, isEntitled
│       ├── format.ts          # Formateo de fechas, mensajes, mojibake
│       └── crypto.ts          # Encriptación AES-256-GCM (tokens OAuth)
├── Dockerfile                 # Build multi-stage (builder + runtime)
├── docker-compose.yml         # Servicios: backend + redis
├── package.json
└── tsconfig.json
```

---

## 3. Configuración y Variables de Entorno

**Archivo:** `src/config.ts`

La configuración se carga desde `process.env` mediante `dotenv` y se exporta como un objeto `config` tipado. **Todas las variables son requeridas en producción** salvo las marcadas como opcionales.

### Variables Críticas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | `supersecret-256bit` |
| `REDIS_URL` | URL de conexión Redis | `redis://localhost:6379` |
| `OPENAI_API_KEY` | API key de OpenAI | `sk-...` |
| `OPENAI_MODEL` | Modelo a usar (default: `gpt-4o`) | `gpt-4o` |
| `FRONTEND_URL` | URL del frontend (CORS, redirects) | `https://contapro.lat` |
| `COOKIE_DOMAIN` | Dominio para cookies | `.contapro.lat` |

### Variables de Integración

| Variable | Servicio |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth Google (Login + Gmail) |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | OAuth Microsoft (Login + Outlook) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME` | Bot de Telegram |
| `WAZEND_API_BASE`, `WAZEND_API_TOKEN`, `WAZEND_SESSION`, `WHATSAPP_NUMBER` | WhatsApp (Wazend/Evolution API) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe Payments |
| `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_QUARTERLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`, `STRIPE_LIFETIME_PRICE_ID` | Price IDs de planes |
| `STRIPE_EXTRA_PROFILE_*_PRICE_ID` | Price IDs para perfiles extra |
| `RESEND_API_KEY`, `MAIL_FROM` | Correo transaccional (Resend) |
| `ENCRYPTION_KEY` | AES-256-GCM para tokens OAuth almacenados |
| `GROQ_API_KEY` | Groq (Whisper transcripción + Llama Vision) |

---

## 4. Punto de Entrada — `index.ts`

**Archivo:** `src/index.ts` (291 líneas)

### Función `buildServer()`

Orquesta el bootstrap completo del servidor Fastify en este orden exacto:

#### 4.1 Plugins Registrados (orden de registro)

```
1. @fastify/sensible        → Errores HTTP semánticos (badRequest, unauthorized, etc.)
2. @fastify/cors             → Origins permitidos, credentials: true
3. @fastify/cookie           → Parsing de cookies
4. @fastify/jwt              → Firma/verificación JWT (secret: config.jwtSecret)
5. @fastify/multipart        → Upload de archivos (límite: 50MB)
6. @fastify/swagger          → Documentación OpenAPI
7. @fastify/swagger-ui       → UI de Swagger en /docs
8. @fastify/raw-body         → Raw body para verificación de webhooks Stripe
9. @fastify/oauth2 (Google)  → OAuth2 para login con Google
10. @fastify/oauth2 (Gmail)  → OAuth2 para Gmail Connect (scope: gmail.readonly)
11. @fastify/oauth2 (Microsoft) → OAuth2 para Outlook Connect
12. Prisma Plugin             → Decorador app.prisma (PrismaClient)
```

#### 4.2 Rutas Registradas

| Prefijo | Plugin | Descripción |
|---|---|---|
| `/api/auth` | `authRoutes` | Autenticación y gestión de cuentas |
| `/api/expenses` | `expensesRoutes` | CRUD de gastos |
| `/api/budget` | `budgetRoutes` | Gestión de presupuestos |
| `/api/upload` | `uploadRoutes` | Subida de documentos |
| `/api/chat` | `chatRoutes` | Chat con agente IA (web) |
| `/api/payments` | `paymentsRoutes` | Checkout, portal, historial |
| `/api/stripe` | `stripeWebhookRoutes` | Webhook de Stripe |
| `/api/integrations` | `integrationsRoutes` | Telegram, WhatsApp, Gmail, Outlook |
| `/api/profiles` | `profilesRoutes` | Gestión de perfiles |
| `/api/categories` | `categoriesRoutes` | CRUD de categorías |
| `/api/savings` | `savingsRoutes` | Metas de ahorro |
| `/api/proxy/documents` | `documentsRoutes` | Proxy de documentos |

#### 4.3 Servicios Inicializados al Arranque

```typescript
// Telegram Bot (Polling)
if (config.telegramBotToken) {
  const tg = new TelegramService(app, config.telegramBotToken);
  app.decorate('telegram', tg);
  tg.startPolling();
}

// WhatsApp Service (Wazend)
if (config.wazendApiBase && config.wazendApiToken) {
  const wa = new WhatsAppService(app);
  app.decorate('whatsapp', wa);
}

// BullMQ Workers
if (config.queuesEnabled && redisConnection) {
  setupEmailScannerWorker(app, redisConnection);
  // Cron: escaneo cada 5 minutos
  emailScannerQueue.add('scan-emails', {}, { repeat: { every: 300000 } });
}

// Cron Jobs
new DailyReportJob(app).start(); // 23:50 diario
```

#### 4.4 Endpoints Infraestructura

| Endpoint | Método | Propósito |
|---|---|---|
| `/health` | GET | Healthcheck (retorna `{ status: 'ok' }`) |
| `/api/whatsapp/webhook` | POST | Webhook de Wazend/Evolution API |

---

## 5. Base de Datos — Prisma Schema

**Archivo:** `prisma/schema.prisma` (447 líneas)

### 5.1 Modelos Principales

#### `User` — Centro del sistema

```prisma
model User {
  id                     String    @id @default(cuid())
  email                  String    @unique
  password               String                    // Hash argon2
  name                   String?
  phoneNumber            String?
  birthDate              DateTime?
  preferredCurrency      String    @default("PEN")
  language               String    @default("es")  // es | en | pt
  plan                   Plan      @default(FREE)  // FREE | PREMIUM | LIFETIME | QUARTERLY | BUSINESS
  planExpires            DateTime?
  trialEnds              DateTime?
  hasUsedTrial           Boolean   @default(false)
  status                 UserStatus @default(PENDING) // PENDING | ACTIVE | SUSPENDED | NEW_LEAD
  verificationCode       String?
  resetCode              String?
  telegramId             String?                   // Chat ID de Telegram
  whatsappPhone          String?                   // Teléfono vinculado
  whatsappLinkedAt       DateTime?
  stripeCustomerId       String?
  stripeSubscriptionId   String?
  extraProfileSlots      Int       @default(0)     // Perfiles extra comprados (Lifetime)
  extraEmailSlots        Int       @default(0)     // Correos extra comprados
  defaultPaymentMethodId String?
  botMessageCount        Int       @default(0)     // Contador mensajes bot (FREE)
  botMessageResetAt      DateTime?
  googleId               String?   @unique         // OAuth Google
  microsoftId            String?   @unique         // OAuth Microsoft
  preferredDateFormat    String    @default("DMY") // DMY | MDY | YMD

  // Relaciones
  profiles               Profile[]
  expenses               Expense[]
  budgets                Budget[]
  documents              Document[]
  categories             Category[]
  payments               Payment[]
  savingsGoals           SavingsGoal[]
  paymentMethods         PaymentMethod[]
  emailIntegrations      EmailIntegration[]
}
```

#### `Profile` — Multi-perfil (Personal/Negocio)

```prisma
model Profile {
  id        String   @id @default(cuid())
  userId    String
  name      String                        // "Mi Perfil", "Negocio"
  isDefault Boolean  @default(false)
  color     String   @default("#7c3aed")  // Color visual del perfil
  avatar    String   @default("default")
  user      User     @relation(...)

  @@unique([userId, name])  // Un usuario no puede tener 2 perfiles con el mismo nombre
}
```

#### `Expense` — Gasto registrado

```prisma
model Expense {
  id              String   @id @default(cuid())
  userId          String
  profileId       String?
  type            ExpenseType              // FACTURA | BOLETA | INFORMAL | YAPE | PLIN | ...
  source          ExpenseSource            // MANUAL | DOCUMENT | AI | EMAIL
  issuedAt        DateTime                 // Fecha del documento
  provider        String                   // Proveedor/comercio
  description     String?
  amount          Float                    // Monto en moneda original
  currency        String   @default("PEN")
  amountNative    Float?                   // Monto convertido a moneda preferida
  exchangeRate    Float?                   // Tasa de cambio usada
  emitterIdNumber String?                  // RUC del emisor
  categoryId      String?
  documentId      String?
  paymentMethodId String?
  createdAt       DateTime @default(now())
}
```

#### `Budget` — Presupuesto mensual

```prisma
model Budget {
  id             String  @id @default(cuid())
  userId         String
  profileId      String?
  month          Int                    // 1-12
  year           Int
  amount         Float                  // Límite de presupuesto
  alertThreshold Float   @default(0.8) // Umbral de alerta (80%)
  alertSent      Boolean @default(false)
  currency       String  @default("PEN")

  @@unique([userId, profileId, year, month])
}
```

#### `CategoryBudget` — Presupuesto por categoría

```prisma
model CategoryBudget {
  id             String  @id @default(cuid())
  userId         String
  profileId      String?
  categoryId     String
  month          Int
  year           Int
  amount         Float
  alertThreshold Float   @default(0.8)
  alertSent      Boolean @default(false)
  currency       String  @default("PEN")

  @@unique([userId, profileId, categoryId, year, month])
}
```

#### `PaymentMethodBudget` — Presupuesto por método de pago

```prisma
model PaymentMethodBudget {
  // Estructura idéntica a CategoryBudget pero
  // vinculado a paymentMethodId en lugar de categoryId
  @@unique([userId, profileId, paymentMethodId, year, month])
}
```

### 5.2 Modelos de Soporte

| Modelo | Propósito |
|---|---|
| `Document` | Archivo subido (path en disco, metadata) |
| `Analysis` | Resultado del análisis IA de un documento |
| `Category` | Categoría de gasto (global o por perfil) |
| `PaymentMethod` | Método de pago (Yape, BCP, Efectivo, etc.) |
| `SavingsGoal` | Metas de ahorro con transacciones |
| `SavingsTransaction` | Depósitos/retiros hacia metas de ahorro |
| `Payment` | Registro de pagos en Stripe |
| `PlanSetting` | Configuración dinámica de planes y precios |
| `PendingExpense` | Gastos detectados por email pendientes de aprobación |
| `EmailIntegration` | Credenciales OAuth para Gmail/Outlook |
| `BudgetHistory` | Historial de cambios en presupuestos |
| `AiCache` | Caché de resultados IA y tasas de cambio (con TTL) |
| `ChatMessage` | Historial de mensajes del agente conversacional |
| `AgentContext` | Contexto persistente del agente por usuario |

### 5.3 Enums

```prisma
enum Plan           { FREE, PREMIUM, LIFETIME, QUARTERLY, BUSINESS }
enum UserStatus     { PENDING, ACTIVE, SUSPENDED, NEW_LEAD }
enum ExpenseType    { FACTURA, BOLETA, INFORMAL, YAPE, PLIN, TUNKI, LEMONPAY, BCP, INTERBANK, SCOTIABANK, BBVA }
enum ExpenseSource  { MANUAL, DOCUMENT, AI, EMAIL }
```

---

## 6. Sistema de Autenticación

**Archivo:** `src/routes/auth.ts` (594 líneas)

### 6.1 Flujo de Registro

```
POST /api/auth/register
    │
    ├─ Validación (zod): email, password (min 8), name
    ├─ Verificar email no existe
    ├─ Hash password con argon2
    ├─ Crear User (status: PENDING)
    ├─ Crear Profile default ("Mi Perfil")
    ├─ Crear PaymentMethod default ("Efectivo")
    ├─ Generar código verificación (6 dígitos)
    ├─ Enviar email con código (Resend)
    └─ Retornar { ok: true, requiresVerification: true }
```

### 6.2 Flujo de Login

```
POST /api/auth/login
    │
    ├─ Buscar usuario por email
    ├─ Verificar password con argon2
    ├─ Verificar status === ACTIVE
    ├─ Generar JWT session token (7d expiry)
    │   payload: { sub: userId, profileId: defaultProfileId }
    ├─ Set cookie "session" (HttpOnly, Secure, SameSite)
    └─ Retornar { ok: true, user: {...} }
```

### 6.3 OAuth2 (Google / Microsoft)

```
GET /api/auth/google/callback
    │
    ├─ Obtener access_token de Google
    ├─ Fetch perfil de Google (email, name, picture)
    ├─ Buscar usuario por googleId o email
    ├─ Si existe → Login (actualizar googleId si falta)
    ├─ Si NO existe → Crear cuenta (status: ACTIVE, sin password)
    ├─ Generar JWT session token
    ├─ Set cookie
    └─ Redirect a frontend /dashboard
```

### 6.4 Gestión de Cookies

**Archivo:** `src/utils/auth.ts`

```typescript
function getCookieOpts(req) {
  return {
    httpOnly: true,
    sameSite: isLocalHost ? 'lax' : 'none',
    path: '/',
    secure: isProd,
    domain: cfgDomain || undefined,
  };
}
```

### 6.5 Middleware `requireAuth`

Extrae y verifica el token JWT de la cookie `session`. Retorna `{ userId, profileId }` o envía error 401.

```typescript
function requireAuth(app, req, res): { userId: string, profileId: string } | null {
  const token = req.cookies.session;
  const payload = app.jwt.verify(token); // { sub, profileId }
  return { userId: payload.sub, profileId: payload.profileId };
}
```

---

## 7. Rutas y Endpoints

### 7.1 Gastos — `expenses.ts` (462 líneas)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/expenses` | GET | Listar gastos (filtros: mes, categoría, tipo, paginación) |
| `/api/expenses` | POST | Crear gasto manual |
| `/api/expenses/:id` | PUT | Actualizar gasto |
| `/api/expenses/:id` | DELETE | Eliminar gasto |
| `/api/expenses/bulk-delete` | POST | Eliminación masiva |
| `/api/expenses/pending` | GET | Listar gastos pendientes de aprobación |
| `/api/expenses/pending/:id/approve` | POST | Aprobar gasto pendiente |
| `/api/expenses/pending/:id/reject` | POST | Rechazar gasto pendiente |

#### Flujo de Creación de Gasto Manual

```
POST /api/expenses
    │
    ├─ requireAuth() → { userId, profileId }
    ├─ Validar body (amount, currency, provider...)
    ├─ Resolver/crear categoría por nombre
    ├─ Resolver método de pago (o usar default)
    ├─ Conversión de moneda si currency ≠ preferredCurrency
    │   └─ CurrencyService.convert(amount, from, to)
    ├─ Crear Expense en Prisma
    ├─ ensureBudgetForUserMonth() → auto-crear presupuesto si no existe
    ├─ checkBudgetAlertAfterExpense() → verificar umbral general
    ├─ checkCategoryBudgetAlertAfterExpense() → verificar umbral categoría
    ├─ checkPaymentMethodBudgetAlertAfterExpense() → verificar umbral MP
    ├─ Notificar vía Telegram si vinculado
    ├─ Notificar vía WhatsApp si vinculado
    └─ Retornar { ok: true, expense }
```

### 7.2 Presupuestos — `budget.ts` (800+ líneas)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/budget` | GET | Obtener presupuesto del mes actual |
| `/api/budget` | POST | Crear/actualizar presupuesto general |
| `/api/budget/adjust` | POST | Agregar/recortar fondos (con historial) |
| `/api/budget/history` | GET | Historial de cambios |
| `/api/budget/category` | POST | Crear/actualizar presupuesto por categoría |
| `/api/budget/category` | GET | Listar presupuestos por categoría |
| `/api/budget/payment-method` | POST | Crear/actualizar presupuesto por MP |
| `/api/budget/payment-method` | GET | Listar presupuestos por MP |

#### Función Crítica: `checkBudgetAlertAfterExpense`

```typescript
async function checkBudgetAlertAfterExpense(app, userId, profileId, date, amount) {
  // 1. Buscar presupuesto del mes
  // 2. Calcular total gastado este mes (aggregate)
  // 3. Si gastado/presupuesto >= alertThreshold Y !alertSent:
  //    a. Marcar alertSent = true
  //    b. Enviar notificación Telegram + WhatsApp
  //    c. Formato: "⚠️ Has gastado el X% de tu presupuesto (S/ Y de S/ Z)"
}
```

### 7.3 Upload de Documentos — `upload.ts` (297 líneas)

```
POST /api/upload
    │
    ├─ requireAuth() + isEntitled()
    ├─ Recibir archivo multipart
    ├─ Pre-procesar imagen con Sharp:
    │   └─ rotate() → greyscale() → normalize() → resize(2000px) → PNG
    ├─ Guardar archivo en /uploads/
    ├─ Crear registro Document en DB
    ├─ Extracción IA (OpenAI):
    │   └─ extractExpenseFields(meta, buffer) → JSON estructurado
    ├─ Resolver categoría (buscar o crear)
    ├─ Resolver método de pago (buscar, crear, o usar default)
    ├─ Conversión de moneda
    ├─ Crear Expense
    ├─ Crear Analysis (resultado IA vinculado al Document)
    ├─ Notificar Telegram + WhatsApp
    ├─ Verificar alertas de presupuesto
    └─ Retornar { ok, summary, expenseId, json, xml }
```

### 7.4 Chat Web — `chat.ts` (151 líneas)

```
POST /api/chat/message
    │
    ├─ requireAuth() + isEntitled()
    ├─ Detectar tipo de input:
    │   ├─ Audio → Groq Whisper transcripción → texto
    │   ├─ Imagen/PDF → Sharp + extractExpenseFields → contexto
    │   └─ Texto → directo
    ├─ ConversationHandler.handleMessage(userId, text, 'WEB', context)
    └─ Retornar { reply: "texto respuesta" }
```

### 7.5 Integraciones — `integrations.ts` (819 líneas)

#### Telegram

| Endpoint | Método |
|---|---|
| `/api/integrations/telegram/status` | GET |
| `/api/integrations/telegram/link` | POST → genera deep-link `t.me/bot?start=CODE` |
| `/api/integrations/telegram/unlink` | POST |
| `/api/integrations/telegram/test` | POST |

#### WhatsApp

| Endpoint | Método |
|---|---|
| `/api/integrations/whatsapp/status` | GET |
| `/api/integrations/whatsapp/link` | POST → genera código + link `wa.me/` |
| `/api/integrations/whatsapp/link/confirm` | POST → confirma vinculación por código |
| `/api/integrations/whatsapp/link/direct` | POST → vincula directo con teléfono |
| `/api/integrations/whatsapp/unlink` | POST |
| `/api/integrations/whatsapp/test` | POST |

#### Gmail Connect

| Endpoint | Método |
|---|---|
| `/api/integrations/google/connect` | GET → redirect a OAuth Google |
| `/api/integrations/google/callback` | GET → callback OAuth, guarda tokens |
| `/api/integrations/google/status` | GET |
| `/api/integrations/google/settings` | PUT → allowedSenders, autoApprove |
| `/api/integrations/google/disconnect` | POST |
| `/api/integrations/google/test` | POST → escaneo manual |

#### Outlook Connect

Misma estructura que Gmail con endpoints `/outlook/*`.

---

## 8. Servicios Core

### 8.1 CurrencyService — `currency.ts`

```typescript
class CurrencyService {
  async getExchangeRate(from, to): Promise<number> {
    // 1. Cache (AiCache, key: "RATE:USD:PEN", TTL: 24h)
    // 2. API: exchangerate-api.com
    // 3. Fallback estático: USD→PEN=3.75, PEN→USD=0.26, etc.
    // 4. Último recurso: 1:1
  }

  async convert(amount, from, to): Promise<{ amount, rate }> {
    const rate = await this.getExchangeRate(from, to);
    return { amount: (amount * rate).toFixed(2), rate };
  }
}
```

### 8.2 ProfileLimitsService — `profile-limits.ts`

```typescript
async function calculateProfileLimits(userId, prisma): Promise<ProfileLimits> {
  // baseLimit por plan: FREE=1, PREMIUM=1, LIFETIME=3, BUSINESS=5
  // + extraProfileSlots (compras Lifetime de un solo pago)
  // + Stripe subscription items (perfiles extra recurrentes)
  // Retorna: { current, max, remaining, canCreate, baseLimit, extraProfiles }
}
```

### 8.3 SubscriptionUtils — `subscription.ts`

```typescript
isPremium(user): boolean
  → LIFETIME plan: true
  → PREMIUM + planExpires > now: true
  → stripeSubscriptionId exists: true (fallback)
  → else: false

isTrial(user): boolean
  → trialEnds > now: true

isEntitled(user): boolean
  → Todos los usuarios registrados: true
  → (Las restricciones del plan FREE se manejan en lugares específicos)
```

### 8.4 NotificationService — `notifications.ts`

Servicio unificado que envía notificaciones a **todos** los canales vinculados del usuario:

```typescript
class NotificationService {
  async notify(userId, message) {
    // 1. Buscar usuario con telegramId y whatsappPhone
    // 2. Si telegramId → enviar por Telegram
    // 3. Si whatsappPhone → enviar por WhatsApp
  }

  async notifyPendingExpense(pendingExpenseId) { ... }
  async notifyPendingExpensesBatch(ids) { ... }
  async notifyExpenseRegistered(expenseId) { ... }
}
```

---

## 9. Sistema de IA y Procesamiento de Documentos

### 9.1 OpenAI Service — `openai.ts` (848 líneas)

Es el servicio más complejo del backend. Contiene tres funciones principales:

#### `extractExpenseFromText(text, defaults)`

Extrae datos de un gasto descrito en lenguaje natural. Ejemplo: _"Compré un café por 5 soles en Starbucks ayer"_.

- **Prompt:** Español, campos JSON estrictos
- **Parsing robusto:** Regex fallback si JSON inválido
- **Fechas relativas:** "hoy", "ayer", "hace 3 días" → cálculo real
- **Montos en palabras:** "veinte soles" → 20
- **Categorización automática** por nombre de proveedor (regex matching)
- **Caché:** SHA-256 del texto → AiCache

#### `extractExpenseFields(meta, fileBuffer, options)`

Pipeline completo de extracción de documentos (imágenes/PDFs):

```
Documento
    │
    ├─ ¿Es PDF?
    │   └─ SÍ → OpenAI Files API + Responses API (gpt-4o)
    │
    ├─ ¿Es imagen?
    │   ├─ 1º: Python LLM (runPythonLLM) → Groq/local
    │   ├─ 2º: Node Vision (OpenAI multimodal) si Python falló
    │   ├─ 3º: Python OCR (runPythonOCR) como fallback si datos pobres
    │   └─ 4º: Node Vision retry con temperature=0 como último recurso
    │
    └─ Normalización:
        ├─ tipo_documento → ExpenseType
        ├─ fecha_emision → YYYY-MM-DD (con heurísticas de extracción)
        ├─ monto_total → Float normalizado
        ├─ moneda → PEN | USD
        ├─ proveedor → String limpio
        ├─ IGV automático (18% si faltan taxes)
        ├─ Validaciones de anomalías (RUC inválido, sumas inconsistentes)
        └─ Generación de XML estructurado
```

#### `transcribeAudio(buffer, mimeType)`

Transcripción de audio usando modelo `gpt-4o-mini-transcribe`. Detecta formato automáticamente por magic bytes.

### 9.2 Groq Service — `groq.ts`

```typescript
class GroqService {
  async transcribeAudio(buffer): Promise<string>
    // Modelo: whisper-large-v3-turbo
    // Idioma: español

  async analyzeImage(dataUri): Promise<object>
    // Modelo: llama-4-scout-17b-16e-instruct
    // Prompt: Extracción de datos financieros de imágenes
    // Output: JSON con amount, currency, merchant, date, etc.
}
```

### 9.3 Agent Service — `agent.ts` (2764 líneas)

El **cerebro** del sistema. Agente conversacional con **function calling** de OpenAI.

#### System Prompt (Estructura)

El prompt del agente incluye:
1. **Perfil del usuario** (nombre, nacionalidad, intereses, profesión)
2. **Snapshot financiero** (presupuesto, gastado, disponible)
3. **Contexto activo** (thread memory, gastos pendientes)
4. **Memoria a largo plazo** (RAG sobre historial de chat)
5. **Perfiles disponibles** y límites
6. **Estado de Gmail Connect**
7. **Instrucciones de comportamiento** (personalidad de amigo cercano, humor, emojis limitados)
8. **Reglas de desambiguación** ("ponlo en comida" vs "guardalo en test")
9. **Formato de respuesta** (listas con emojis, separadores, IDs)

#### Tools (Function Calling) — 20+ herramientas

| Tool | Acción |
|---|---|
| `createExpense` | Registrar gasto (auto-categoriza, auto-pago) |
| `updateExpense` | Modificar gasto existente |
| `deleteExpense` | Eliminar uno o varios gastos |
| `createCategory` | Crear categoría |
| `deleteCategory` | Eliminar categoría |
| `createPaymentMethod` | Crear método de pago |
| `deletePaymentMethod` | Eliminar método de pago |
| `setDefaultPaymentMethod` | Establecer MP como principal |
| `getRecentExpenses` | Consultar gastos (con filtros) |
| `getPendingExpenses` | Gastos pendientes de email |
| `getBudget` | Consultar presupuesto |
| `updateBudget` | Cambiar límite de presupuesto |
| `adjustBudgetFunds` | Agregar/recortar fondos (con log) |
| `getBudgetHistory` | Historial de cambios |
| `manageCategoryBudget` | Presupuesto por categoría |
| `managePaymentMethodBudget` | Presupuesto por MP |
| `getPaymentMethods` | Listar métodos de pago |
| `getFinancialReport` | Reporte financiero completo |
| `getSubscriptionStatus` | Estado de suscripción |
| `updateUserConfig` | Cambiar idioma, moneda, etc. |
| `addSavingsTransaction` | Aportar a meta de ahorro |

### 9.4 ConversationHandler — `conversation.ts`

Capa de orquestación que unifica el flujo de conversación entre canales:

```typescript
class ConversationHandler {
  async handleMessage(userId, text, channel, context?) {
    // 1. Cargar historial de conversación
    // 2. Enriquecer contexto (extraction, imageUrl, profileId)
    // 3. Delegar a AgentService.processMessage()
    // 4. Guardar mensaje y respuesta en ChatMessage
    // 5. Actualizar AgentContext
    // 6. Retornar respuesta (string o { text, buttons })
  }
}
```

---

## 10. Integraciones de Mensajería

### 10.1 Telegram — `telegram.ts` (785 líneas)

**Arquitectura:** Long-polling nativo (sin webhook). Procesa updates en un loop infinito.

#### Flujo de un Mensaje Entrante

```
TelegramUpdate
    │
    ├─ /start <code> → Vincular cuenta (código temporal en AiCache, TTL=600s)
    ├─ Contacto compartido → Crear shadow account + SalesService pitch
    ├─ Usuario NO vinculado → Solicitar contacto (keyboard button)
    ├─ Usuario vinculado pero plan expirado → SalesService.handleExpired()
    ├─ Límite FREE alcanzado (5 msgs/mes) → Mensaje de upgrade
    │
    ├─ /add → Flujo manual paso a paso (FSM en AiCache):
    │   └─ tipo → amount → currency → provider → date → description → category → CREATE
    │
    ├─ Texto libre → ConversationHandler.handleMessage('TELEGRAM')
    │
    ├─ Foto → processUploadedBuffer():
    │   └─ Sharp preprocess → Groq Vision → ConversationHandler
    │
    ├─ Documento → processUploadedBuffer()
    │
    └─ Audio/Voz → Groq Whisper → ConversationHandler
```

#### Características Especiales

- **Typing indicator:** `sendChatAction('typing')` antes de procesar
- **Límite FREE:** 5 mensajes/mes (reset mensual automático)
- **Shadow accounts:** Cuentas creadas desde Telegram sin email real (`{phone}@contapro.temp`)

### 10.2 WhatsApp — `whatsapp.ts` (761 líneas)

**Arquitectura:** Webhook entrante (Wazend/Evolution API). El servidor recibe POST en `/api/whatsapp/webhook`.

#### API de Wazend (Evolution API v2)

| Endpoint | Uso |
|---|---|
| `POST /message/sendText/{session}` | Enviar texto |
| `POST /message/sendMedia/{session}` | Enviar imagen/archivo |
| `POST /message/sendReaction/{session}` | Enviar reacción emoji |
| `POST /message/sendUrlButton/{session}` | Enviar botón con URL |
| `POST /chat/sendPresence/{session}` | Indicador "escribiendo..." |
| `POST /chat/getBase64FromMediaMessage/{session}` | Descargar media por message ID |

#### Flujo de Procesamiento

```
Webhook POST → extractIncoming(body)
    │
    ├─ Normalizar payload (múltiples formatos de Evolution API)
    ├─ Extraer: from, text, type, imageUrl, audioUrl, documentUrl, messageId
    │
    ├─ Texto:
    │   ├─ Verificar vinculación → SalesService si no vinculado
    │   ├─ Verificar suscripción → SalesService si expirada
    │   ├─ Reacción ⏳ al mensaje
    │   ├─ startTyping() (intervalo 10s)
    │   ├─ ConversationHandler.handleMessage('WHATSAPP')
    │   ├─ sendText() o sendUrlButton()
    │   └─ Reacción ✅ al mensaje
    │
    ├─ Imagen:
    │   ├─ Descargar media (3 intentos: apikey, Bearer, sin auth)
    │   ├─ Sharp preprocess (rotate, greyscale, sharpen, modulate brightness)
    │   ├─ Groq Vision → imageAnalysis
    │   ├─ ConversationHandler con contexto {extraction, imageUrl}
    │   └─ Guardar Document + responder
    │
    └─ Audio:
        ├─ Descargar media
        ├─ Groq Whisper → transcripción
        └─ AgentService.processMessage(transcripción)
```

#### Vinculación por Código

```
1. Frontend: POST /api/integrations/whatsapp/link
   → Genera código alfanumérico (ej. "x3k9m2") en AiCache (TTL=600s)
   → Retorna { code, waMe: "https://wa.me/51...?text=x3k9m2" }

2. Usuario envía código por WhatsApp al bot

3. Webhook recibe mensaje:
   → Busca AiCache key "wa_link:x3k9m2"
   → Actualiza User.whatsappPhone
   → Envía mensaje de bienvenida
```

---

## 11. Integración de Email (Gmail/Outlook)

### 11.1 Email Scanner Worker — `emailScanner.ts` (796 líneas)

**Tecnología:** BullMQ Worker + Puppeteer + Groq Vision + AgentService

#### Pipeline de Escaneo

```
BullMQ Job (cada 5 min o manual)
    │
    ├─ Obtener EmailIntegrations activas
    │
    ├─ Por cada integración:
    │   ├─ Refrescar token OAuth si necesario
    │   ├─ Construir query dinámica de remitentes permitidos:
    │   │   └─ "label:inbox newer_than:1d (from:yape OR subject:plin OR ...)"
    │   ├─ Listar mensajes (max 30)
    │   │
    │   └─ Por cada mensaje:
    │       ├─ Verificar si ya procesado (PendingExpense.sourceId)
    │       ├─ Obtener contenido (HTML o texto)
    │       ├─ Screenshot con Puppeteer:
    │       │   └─ setContent(html) → setViewport(390x844) → screenshot(fullPage)
    │       ├─ Groq Vision → analizar screenshot
    │       ├─ AgentService.processEmailInput() → JSON { is_expense, amount, ... }
    │       │
    │       └─ handleExtractionResult():
    │           ├─ is_expense=false → PendingExpense(status: IGNORED)
    │           ├─ fecha > 60 días → PendingExpense(status: REJECTED)
    │           ├─ autoApprove=true → Crear Expense directamente + notificar
    │           └─ autoApprove=false → PendingExpense(status: WAITING_USER) + notificar
    │
    └─ Actualizar lastSync de la integración
```

#### Circuit Breaker

Si Gmail/Outlook devuelve `invalid_grant`, la integración se **desactiva automáticamente** (`isActive: false`) para evitar loops de error.

### 11.2 Correo Transaccional — `email.ts` (247 líneas)

**Proveedor principal:** Resend API
**Fallback:** SMTP (Nodemailer)

| Función | Uso |
|---|---|
| `sendVerificationEmail` | Código de 6 dígitos para verificar cuenta |
| `sendPasswordResetEmail` | Código para restablecer contraseña |
| `sendPurchaseReceiptEmail` | Recibo de compra Premium |
| `generateCode` | 6 dígitos aleatorios |

**Internacionalización:** Todas las plantillas soportan `es` y `en`.

**Templates:** HTML inline con diseño minimalista (no usa motor de templates externo).

---

## 12. Sistema de Pagos — Stripe

### 12.1 Configuración — `stripe.ts`

```typescript
const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2025-12-15.clover',
});

getStripePriceId(plan): // MONTHLY | QUARTERLY | ANNUAL | LIFETIME
getExtraProfilePriceId(interval): // month | quarter | year | lifetime
getExtraEmailPriceId(): // Precio fijo para correo extra
```

### 12.2 Checkout — `payments.ts`

```
POST /api/payments/checkout { plan, trial? }
    │
    ├─ Validar plan: MONTHLY | QUARTERLY | ANNUAL | LIFETIME | EXTRA_PROFILE | EXTRA_EMAIL
    ├─ Si trial=true: solo MONTHLY, verificar !hasUsedTrial
    ├─ Si ya tiene suscripción activa → redirect a Stripe Portal
    ├─ Crear/recuperar Stripe Customer
    ├─ TikTok pixel: InitiateCheckout event
    ├─ Crear Checkout Session:
    │   ├─ mode: 'subscription' (MONTHLY/QUARTERLY/ANNUAL) o 'payment' (LIFETIME)
    │   ├─ trial_period_days: 7 (si trial)
    │   └─ metadata: { userId, plan, orderId }
    ├─ Crear Payment(status: PENDING) en DB
    └─ Retornar { url: session.url }
```

### 12.3 Webhook — `stripe_webhook.ts`

```
POST /api/stripe/webhook
    │
    ├─ Verificar firma (stripe.webhooks.constructEvent)
    │
    ├─ checkout.session.completed:
    │   ├─ EXTRA_PROFILE (payment) → incrementar extraProfileSlots
    │   ├─ EXTRA_EMAIL → incrementar extraEmailSlots
    │   └─ Plan (MONTHLY/QUARTERLY/ANNUAL/LIFETIME):
    │       ├─ Calcular expires desde Stripe subscription
    │       ├─ Actualizar User: plan, planExpires, stripeSubscriptionId
    │       ├─ hasUsedTrial = true
    │       └─ TikTok pixel: Purchase event
    │
    └─ invoice.payment_succeeded:
        └─ Renovación: sync planExpires con current_period_end de Stripe
```

---

## 13. Tareas en Segundo Plano — BullMQ & Cron

### 13.1 Colas BullMQ

| Cola | Worker | Frecuencia | Función |
|---|---|---|---|
| `email-scanner` | `emailScanner.ts` | Cada 5 minutos | Escanear Gmail/Outlook |
| `email-scanner` (manual) | `emailScanner.ts` | On-demand | Escaneo manual desde UI |
| `analysis` | `analysisWorker.ts` | On-demand | Procesamiento IA de documentos |

### 13.2 Cron Jobs

| Job | Schedule | Descripción |
|---|---|---|
| `DailyReportJob` | `50 23 * * *` (23:50 diario) | Genera imagen-resumen del día y lo envía por WhatsApp |
| Budget Reset | `0 0 1 * *` (1º de cada mes) | Reset de `alertSent` en todos los budgets |

### 13.3 DailyReportJob — `DailyReportJob.ts`

```
23:50 → Para cada usuario con WhatsApp vinculado:
    │
    ├─ Obtener gastos de HOY
    ├─ Calcular: total, categoría más alta, top 4 categorías
    ├─ Generar tip financiero contextual
    ├─ ImageGeneratorService.generateDailySummaryImage(data) → Buffer PNG
    └─ WhatsApp.sendMedia(phone, imageBuffer, caption)
```

---

## 14. Utilidades

### 14.1 JWT — `jwt.ts`

```typescript
generateMagicToken(userId, expiresIn='24h', profileId?)
  → Payload: { userId, action: 'activate_trial', profileId? }

generateSessionToken(userId, profileId, expiresIn='7d')
  → Payload: { sub: userId, userId, profileId, type: 'session' }

verifyMagicToken(token) → { userId, action, profileId? } | null
verifySessionToken(token) → { userId, profileId, type, sub } | null
```

### 14.2 Crypto — `crypto.ts`

```typescript
encrypt(plaintext): string
  → AES-256-GCM con ENCRYPTION_KEY
  → Output: "iv:authTag:ciphertext" (hex)

decrypt(encrypted): string
  → Inverso de encrypt
```

**Uso:** Almacenar tokens OAuth de Gmail/Outlook en la base de datos de forma segura.

### 14.3 Format — `format.ts`

| Función | Uso |
|---|---|
| `formatDMY(date)` | `DD/MM/YYYY` |
| `fixUtf8Mojibake(s)` | Corrige "TecnologÃ­a" → "Tecnología" |
| `sanitizeText(input)` | Limpia texto: remove scripts, normalize whitespace, fix encoding |
| `formatExpenseMessage(input)` | Formato estándar para notificaciones de gasto |
| `formatBudgetSummaryMessage(input)` | Formato estándar para resumen de presupuesto |

---

## 15. Despliegue — Docker

### 15.1 Dockerfile (Multi-Stage)

```dockerfile
# Build Stage: node:20-bullseye
FROM node:20-bullseye AS builder
  → npm ci
  → npx prisma generate
  → npm run build

# Runtime Stage: node:20-bullseye-slim
FROM node:20-bullseye-slim AS runtime
  → apt-get: libvips, curl, python3, puppeteer-deps
  → npm ci --omit=dev
  → Copy: prisma client, dist, python helpers
  → Install Chrome for Puppeteer
  → Python venv + pip install requirements.txt
  → USER node
  → CMD: node dist/index.js
```

### 15.2 Docker Compose

```yaml
services:
  backend:
    build: .
    ports: ["8080:8080"]
    environment: [DATABASE_URL, OPENAI_API_KEY, JWT_SECRET, REDIS_URL, ...]
    volumes: ["./uploads:/app/uploads"]
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    volumes: ["redis-data:/data"]
    command: ["redis-server", "--appendonly", "yes"]
```

---

## 16. Convenciones y Reglas de Oro

### 16.1 Seguridad

- **NUNCA** exponer `userId` o `profileId` desde el cliente; siempre extraerlos del JWT.
- **TODA** query Prisma DEBE filtrar por `userId` y opcionalmente `profileId`.
- Tokens OAuth se almacenan **encriptados** con AES-256-GCM.
- Passwords hasheados con **argon2**.
- Cookies: `HttpOnly`, `Secure` (prod), `SameSite: none` (cross-origin).

### 16.2 Manejo de Errores

- Usar `@fastify/sensible` para respuestas semánticas: `res.badRequest()`, `res.unauthorized()`, etc.
- Workers BullMQ: catch en cada integración individual, no crashear el worker completo.
- Circuit breaker: desactivar integraciones con tokens inválidos (`invalid_grant`).

### 16.3 Convenciones de Código

- **ESM puro:** Todos los imports usan `.js` extension (ej. `import { config } from '../config.js'`)
- **TypeScript strict mode** habilitado.
- **Target:** ES2020
- **Prisma:** Siempre usar transacciones (`$transaction`) para operaciones multi-tabla críticas.
- **Logs:** `app.log.info/warn/error` con objetos estructurados `{ msg, ...data }`.

### 16.4 Flujo de Datos de un Gasto

```
Origen (Web/WhatsApp/Telegram/Email)
    │
    ├─ Texto NL → OpenAI extractExpenseFromText → JSON
    ├─ Imagen → Sharp preprocess → Groq Vision / OpenAI extractExpenseFields → JSON
    ├─ Audio → Groq Whisper → Texto → OpenAI extractExpenseFromText → JSON
    ├─ PDF → OpenAI Files API → JSON
    └─ Manual → Form/bot paso a paso → JSON
        │
        ▼
    Normalización:
    ├─ Tipo de documento (ExpenseType enum)
    ├─ Moneda (normalizeCurrency)
    ├─ Fecha (normalizeDate + heurísticas)
    ├─ Monto (parseAmount: locale-aware)
    ├─ Categoría (auto-resolución + creación)
    ├─ Método de pago (auto-match + creación)
    └─ Conversión de moneda (CurrencyService)
        │
        ▼
    Prisma: Expense.create()
        │
        ▼
    Post-procesamiento:
    ├─ ensureBudgetForUserMonth()
    ├─ checkBudgetAlertAfterExpense()
    ├─ checkCategoryBudgetAlertAfterExpense()
    ├─ checkPaymentMethodBudgetAlertAfterExpense()
    ├─ Notificación Telegram (si vinculado)
    └─ Notificación WhatsApp (si vinculado)
```

---

> **Este documento es la fuente de verdad técnica del backend de ContaPRO.**
> Cada cambio arquitectónico significativo debe reflejarse aquí.

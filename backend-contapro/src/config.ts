import dotenv from 'dotenv';
// Ensure .env values override any existing environment variables (e.g., system-level)
dotenv.config({ override: true });

export const config = {
  port: Number(process.env.PORT || 8080),
  jwtSecret: String(process.env.JWT_SECRET || 'dev-secret'),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 900),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
  rateLimitMaxAuth: Number(process.env.RATE_LIMIT_MAX_AUTH || process.env.RATE_LIMIT_AUTH_MAX || 2000),
  // Tamaño máximo de subida desde web (en MB). Por defecto 15 MB.
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_MB ? Number(process.env.UPLOAD_MAX_MB) * 1024 * 1024 : 15 * 1024 * 1024),
  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
  gmailCallbackUrl: process.env.GMAIL_CALLBACK_URL || '',

  // Microsoft / Outlook OAuth
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  outlookCallbackUrl: process.env.OUTLOOK_CALLBACK_URL || '',

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotName: process.env.TELEGRAM_BOT_NAME || '',
  // Wazend / WhatsApp
  wazendApiBase: process.env.WAZEND_API_BASE || '',
  wazendApiToken: process.env.WAZEND_API_TOKEN || '',
  whatsappNumber: process.env.WHATSAPP_NUMBER || '',
  wazendSession: process.env.WAZEND_SESSION || '',
  whatsappTestMessage: process.env.WHATSAPP_TEST_MESSAGE || '🔔 Prueba de notificación desde ContaPRO',
  whatsappWelcomeMessage: process.env.WHATSAPP_WELCOME_MESSAGE || '👋 Bienvenido a ContaPRO. Soy tu asistente financiero IA. Puedes enviarme fotos de tus gastos, audios o simplemente decirme "registra un gasto de 50 soles en comida". ¡Estoy aquí para ayudarte en lo que necesites!',
  
  // WhatsApp Provider (Evolution API, etc)
  whatsappApiUrl: process.env.WHATSAPP_API_URL || '',
  whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
  whatsappInstanceName: process.env.WHATSAPP_INSTANCE_NAME || '',

  cookieDomain: process.env.COOKIE_DOMAIN || '',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  backendPublicUrl: (process.env.BACKEND_PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, ''),
  // Stripe
  stripeMode: (process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? 'production' : 'dev',
  stripeSecretKey: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_SECRET_KEY_PROD : process.env.STRIPE_SECRET_KEY_DEV) || '',
  stripePublishableKey: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_PUBLISHABLE_KEY_PROD : process.env.STRIPE_PUBLISHABLE_KEY_DEV) || '',
  stripeWebhookSecret: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_WEBHOOK_SECRET_PROD : process.env.STRIPE_WEBHOOK_SECRET_DEV) || '',
  // Precios (Price IDs de Stripe)
  stripeMonthlyPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_MONTHLY_PRICE_ID_PROD : process.env.STRIPE_MONTHLY_PRICE_ID_DEV) || '',
  stripeQuarterlyPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_QUARTERLY_PRICE_ID_PROD : process.env.STRIPE_QUARTERLY_PRICE_ID_DEV) || '',
  stripeAnnualPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_ANNUAL_PRICE_ID_PROD : process.env.STRIPE_ANNUAL_PRICE_ID_DEV) || '',
  stripeLifetimePriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_LIFETIME_PRICE_ID_PROD : process.env.STRIPE_LIFETIME_PRICE_ID_DEV) || '',
  
  // Precios de Perfiles Extra
  stripeExtraProfileMonthlyPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_MONTHLY_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_MONTHLY_PRICE_ID_DEV) || '',
  stripeExtraProfileQuarterlyPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_QUARTERLY_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_QUARTERLY_PRICE_ID_DEV) || '',
  stripeExtraProfileAnnualPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_ANNUAL_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_ANNUAL_PRICE_ID_DEV) || '',
  stripeExtraProfileLifetimePriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_LIFETIME_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_LIFETIME_PRICE_ID_DEV) || '',
  
  // Precios de Correos Extra (S/ 5 al mes aprox)
  stripeExtraEmailMonthlyPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_EMAIL_MONTHLY_PRICE_ID_PROD : process.env.STRIPE_EXTRA_EMAIL_MONTHLY_PRICE_ID_DEV) || '',
  stripeExtraEmailAnnualPriceId: ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_EMAIL_ANNUAL_PRICE_ID_PROD : process.env.STRIPE_EXTRA_EMAIL_ANNUAL_PRICE_ID_DEV) || '',
  
  // Flow
  flowMode: (process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? 'production' : 'dev',
  flowApiKey: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_API_KEY_PROD
    : process.env.FLOW_API_KEY_DEV) || '',
  flowSecretKey: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_SECRET_KEY_PROD
    : process.env.FLOW_SECRET_KEY_DEV) || '',
  flowBaseUrl: (process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? 'https://www.flow.cl/api'
    : 'https://sandbox.flow.cl/api',

  // Flow Plan IDs
  flowPlanMonthlyId: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_PLAN_MONTHLY_ID_PROD
    : process.env.FLOW_PLAN_MONTHLY_ID_DEV) || '',
  flowPlanAnnualId: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_PLAN_ANNUAL_ID_PROD
    : process.env.FLOW_PLAN_ANNUAL_ID_DEV) || '',
  flowPlanExtraProfileMonthlyId: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_PLAN_EXTRA_PROFILE_MONTHLY_ID_PROD
    : process.env.FLOW_PLAN_EXTRA_PROFILE_MONTHLY_ID_DEV) || '',
  flowPlanExtraProfileAnnualId: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_PLAN_EXTRA_PROFILE_ANNUAL_ID_PROD
    : process.env.FLOW_PLAN_EXTRA_PROFILE_ANNUAL_ID_DEV) || '',
  flowPlanExtraEmailMonthlyId: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_PLAN_EXTRA_EMAIL_MONTHLY_ID_PROD
    : process.env.FLOW_PLAN_EXTRA_EMAIL_MONTHLY_ID_DEV) || '',
  flowPlanExtraEmailAnnualId: ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod')
    ? process.env.FLOW_PLAN_EXTRA_EMAIL_ANNUAL_ID_PROD
    : process.env.FLOW_PLAN_EXTRA_EMAIL_ANNUAL_ID_DEV) || '',

  usdToPen: Number(process.env.USD_TO_PEN || 3.8),
  // Redis + Colas
  redisUrl: (process.env.REDIS_URL || '').trim(),
  queuesEnabled: String(process.env.QUEUES_ENABLED || '').toLowerCase() === 'true',
  
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: (process.env.OPENAI_MODEL || 'gpt-4o').trim(),
  
  // Groq
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  groqAudioModel: process.env.GROQ_AUDIO_MODEL || 'whisper-large-v3-turbo',
  groqVisionModel: process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview',

  // TikTok
  tiktokAccessToken: process.env.TIKTOK_ACCESS_TOKEN || 'c8eda47f2e0221f8f0d8dfb42996c0186aa35162',
  tiktokPixelId: process.env.TIKTOK_PIXEL_ID || 'D5FVAGRC77U4NSOIFJ7G',
  
  // Admin
  adminEmail: process.env.ADMIN_EMAIL || '',
};
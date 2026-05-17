import dotenv from 'dotenv';
// Ensure .env values override any existing environment variables (e.g., system-level)
dotenv.config({ override: true });

export const config = {
  get port() { return Number(process.env.PORT || 8080) },
  get jwtSecret() { return String(process.env.JWT_SECRET || 'dev-secret') },
  get cognitoUserPoolId() { return process.env.COGNITO_USER_POOL_ID || '' },
  get cognitoClientId() { return process.env.COGNITO_CLIENT_ID || '' },
  get cognitoRegion() { return process.env.COGNITO_REGION || 'us-east-1' },
  get awsRegion() { return process.env.AWS_REGION || 'us-east-1' },
  get awsSecretsManagerSecretId() { return process.env.AWS_SECRETS_MANAGER_SECRET_ID || '' },
  get cacheTtlSeconds() { return Number(process.env.CACHE_TTL_SECONDS || 900) },
  get rateLimitMax() { return Number(process.env.RATE_LIMIT_MAX || 100) },
  get rateLimitMaxAuth() { return Number(process.env.RATE_LIMIT_MAX_AUTH || process.env.RATE_LIMIT_AUTH_MAX || 2000) },
  get uploadMaxBytes() { return Number(process.env.UPLOAD_MAX_MB ? Number(process.env.UPLOAD_MAX_MB) * 1024 * 1024 : 15 * 1024 * 1024) },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID || '' },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET || '' },
  get googleCallbackUrl() { return process.env.GOOGLE_CALLBACK_URL || '' },
  get gmailCallbackUrl() { return process.env.GMAIL_CALLBACK_URL || '' },

  get microsoftClientId() { return process.env.MICROSOFT_CLIENT_ID || '' },
  get microsoftClientSecret() { return process.env.MICROSOFT_CLIENT_SECRET || '' },
  get outlookCallbackUrl() { return process.env.OUTLOOK_CALLBACK_URL || '' },

  get telegramBotToken() { return process.env.TELEGRAM_BOT_TOKEN || '' },
  get telegramBotName() { return process.env.TELEGRAM_BOT_NAME || '' },
  
  get wazendApiBase() { return process.env.WAZEND_API_BASE || '' },
  get wazendApiToken() { return process.env.WAZEND_API_TOKEN || '' },
  get whatsappNumber() { return process.env.WHATSAPP_NUMBER || '' },
  get wazendSession() { return process.env.WAZEND_SESSION || '' },
  get whatsappTestMessage() { return process.env.WHATSAPP_TEST_MESSAGE || '🔔 Prueba de notificación desde ContaPRO' },
  get whatsappWelcomeMessage() { return process.env.WHATSAPP_WELCOME_MESSAGE || '👋 Bienvenido a ContaPRO. Soy tu asistente financiero IA. Puedes enviarme fotos de tus gastos, audios o simplemente decirme "registra un gasto de 50 soles en comida". ¡Estoy aquí para ayudarte en lo que necesites!' },
  
  get whatsappApiUrl() { return process.env.WHATSAPP_API_URL || '' },
  get whatsappApiKey() { return process.env.WHATSAPP_API_KEY || '' },
  get whatsappInstanceName() { return process.env.WHATSAPP_INSTANCE_NAME || '' },

  get cookieDomain() { return process.env.COOKIE_DOMAIN || '' },
  get frontendUrl() { return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '') },
  get backendPublicUrl() { return (process.env.BACKEND_PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, '') },
  
  get stripeMode() { return (process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? 'production' : 'dev' },
  get stripeSecretKey() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_SECRET_KEY_PROD : process.env.STRIPE_SECRET_KEY_DEV) || '' },
  get stripePublishableKey() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_PUBLISHABLE_KEY_PROD : process.env.STRIPE_PUBLISHABLE_KEY_DEV) || '' },
  get stripeWebhookSecret() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_WEBHOOK_SECRET_PROD : process.env.STRIPE_WEBHOOK_SECRET_DEV) || '' },
  
  get stripeMonthlyPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_MONTHLY_PRICE_ID_PROD : process.env.STRIPE_MONTHLY_PRICE_ID_DEV) || '' },
  get stripeQuarterlyPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_QUARTERLY_PRICE_ID_PROD : process.env.STRIPE_QUARTERLY_PRICE_ID_DEV) || '' },
  get stripeAnnualPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_ANNUAL_PRICE_ID_PROD : process.env.STRIPE_ANNUAL_PRICE_ID_DEV) || '' },
  get stripeLifetimePriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_LIFETIME_PRICE_ID_PROD : process.env.STRIPE_LIFETIME_PRICE_ID_DEV) || '' },
  
  get stripeExtraProfileMonthlyPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_MONTHLY_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_MONTHLY_PRICE_ID_DEV) || '' },
  get stripeExtraProfileQuarterlyPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_QUARTERLY_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_QUARTERLY_PRICE_ID_DEV) || '' },
  get stripeExtraProfileAnnualPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_ANNUAL_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_ANNUAL_PRICE_ID_DEV) || '' },
  get stripeExtraProfileLifetimePriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_PROFILE_LIFETIME_PRICE_ID_PROD : process.env.STRIPE_EXTRA_PROFILE_LIFETIME_PRICE_ID_DEV) || '' },
  
  get stripeExtraEmailMonthlyPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_EMAIL_MONTHLY_PRICE_ID_PROD : process.env.STRIPE_EXTRA_EMAIL_MONTHLY_PRICE_ID_DEV) || '' },
  get stripeExtraEmailAnnualPriceId() { return ((process.env.STRIPE_MODE === 'production' || process.env.STRIPE_MODE === 'prod') ? process.env.STRIPE_EXTRA_EMAIL_ANNUAL_PRICE_ID_PROD : process.env.STRIPE_EXTRA_EMAIL_ANNUAL_PRICE_ID_DEV) || '' },
  
  get flowMode() { return (process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? 'production' : 'dev' },
  get flowApiKey() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_API_KEY_PROD : process.env.FLOW_API_KEY_DEV) || '' },
  get flowSecretKey() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_SECRET_KEY_PROD : process.env.FLOW_SECRET_KEY_DEV) || '' },
  get flowBaseUrl() { return (process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? 'https://www.flow.cl/api' : 'https://sandbox.flow.cl/api' },

  get flowPlanMonthlyId() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_PLAN_MONTHLY_ID_PROD : process.env.FLOW_PLAN_MONTHLY_ID_DEV) || '' },
  get flowPlanAnnualId() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_PLAN_ANNUAL_ID_PROD : process.env.FLOW_PLAN_ANNUAL_ID_DEV) || '' },
  get flowPlanExtraProfileMonthlyId() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_PLAN_EXTRA_PROFILE_MONTHLY_ID_PROD : process.env.FLOW_PLAN_EXTRA_PROFILE_MONTHLY_ID_DEV) || '' },
  get flowPlanExtraProfileAnnualId() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_PLAN_EXTRA_PROFILE_ANNUAL_ID_PROD : process.env.FLOW_PLAN_EXTRA_PROFILE_ANNUAL_ID_DEV) || '' },
  get flowPlanExtraEmailMonthlyId() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_PLAN_EXTRA_EMAIL_MONTHLY_ID_PROD : process.env.FLOW_PLAN_EXTRA_EMAIL_MONTHLY_ID_DEV) || '' },
  get flowPlanExtraEmailAnnualId() { return ((process.env.FLOW_MODE === 'production' || process.env.FLOW_MODE === 'prod') ? process.env.FLOW_PLAN_EXTRA_EMAIL_ANNUAL_ID_PROD : process.env.FLOW_PLAN_EXTRA_EMAIL_ANNUAL_ID_DEV) || '' },

  get usdToPen() { return Number(process.env.USD_TO_PEN || 3.8) },
  get redisUrl() { return (process.env.REDIS_URL || '').trim() },
  get queuesEnabled() { return String(process.env.QUEUES_ENABLED || '').toLowerCase() === 'true' },

  get openaiApiKey() { return process.env.OPENAI_API_KEY || '' },
  get openaiModel() { return (process.env.OPENAI_MODEL || 'gpt-4o').trim() },

  get groqApiKey() { return process.env.GROQ_API_KEY || '' },
  get groqModel() { return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
  get groqAudioModel() { return process.env.GROQ_AUDIO_MODEL || 'whisper-large-v3-turbo' },
  get groqVisionModel() { return process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview' },

  get tiktokAccessToken() { return process.env.TIKTOK_ACCESS_TOKEN || 'c8eda47f2e0221f8f0d8dfb42996c0186aa35162' },
  get tiktokPixelId() { return process.env.TIKTOK_PIXEL_ID || 'D5FVAGRC77U4NSOIFJ7G' },

  get adminEmail() { return process.env.ADMIN_EMAIL || '' },
};
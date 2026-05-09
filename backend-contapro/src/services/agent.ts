import { FastifyInstance } from 'fastify';
import OpenAI from 'openai';
import { config } from '../config.js';
import { getRedis } from './redis.js';
import { sanitizeText, formatDMY } from '../utils/format.js';
import { checkBudgetAlertAfterExpense, ensureBudgetForUserMonth } from '../routes/budget.js';
import { calculateProfileLimits } from './profile-limits.js';
import { CurrencyService } from './currency.js';
import { getAmountNative } from '../utils/currency-helper.js';
import { DailyReportJob } from '../jobs/DailyReportJob.js';

export class AgentService {
  private app: FastifyInstance;
  private openai: OpenAI;
  private currencyService: CurrencyService;

  constructor(app: FastifyInstance) {
    this.app = app;
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.currencyService = new CurrencyService(app);
  }

  /**
   * Procesa un correo electrónico para extraer información de gastos.
   * Utiliza la misma inteligencia que el chat pero optimizada para emails.
   */
  async processEmailInput(userId: string, emailBody: string): Promise<any> {
    try {
        const completion = await this.openai.chat.completions.create({
            model: config.openaiModel || "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Eres un experto analista financiero. Tu tarea es extraer datos de gastos de correos electrónicos o resultados de visión artificial (OCR).
                    
                    Analiza el siguiente texto (puede ser contenido de email o un JSON pre-procesado) y extrae la información en JSON estricto.
                    
                    Reglas PRIORITARIAS:
                    1. SI EL INPUT CONTIENE UN JSON CON "operation_type": "SENT" -> ES GASTO (is_expense: true).
                    2. SI EL INPUT CONTIENE "operation_type": "RECEIVED" -> NO ES GASTO (is_expense: false).
                    
                    Reglas Generales:
                    1. Si es un gasto válido (compras, pagos, envíos de dinero, retiros, yapeos enviados), "is_expense": true.
                    2. CASO YAPE/PLIN (Crucial):
                       - Palabras clave GASTO: "Enviaste", "Acabas de yapear", "¡Yapeaste!", "Realizaste un envío", "Pago realizado", "Sent". -> is_expense: true.
                       - Palabras clave INGRESO: "Recibiste", "Te enviaron", "Abono", "Devolución", "Received". -> is_expense: false.
                    3. Si es solo publicidad, estado de cuenta mensual, o no es un gasto, "is_expense": false.
                    4. "amount": número positivo. Si NO encuentras el monto pero estás seguro que es un gasto, devuelve 0.
                    5. "currency": "PEN" o "USD" (detecta S/, Soles, US$, Dólares).
                    6. "merchant": Intenta extraer el nombre del destinatario. 
                       - En Yape/Plin, suele estar después de "Yapeaste a", "Enviaste a", "Destino:", o en el título "¡Hola, [Nombre]!".
                       - Si no encuentras un nombre claro, usa "Yape/Plin". NO uses "Unknown" si es claramente un Yape o cualquier tipo de gasto.
                    7. "description": breve descripción del gasto.
                    8. "date": Si hay fecha explícita, úsala (ISO 8601). Si no, null.
                    
                    Responde SOLO el JSON.`
                },
                {
                    role: "user",
                    content: `Analiza este correo:\n\n${(sanitizeText(emailBody) || "").substring(0, 2000)}`
                }
            ],
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) return null;
        
        return JSON.parse(content);
    } catch (error) {
        this.app.log.error({ msg: 'Error in processEmailInput', error });
        return null;
    }
  }

  async processMessage(userId: string, text: string, context?: any): Promise<string | { text: string; buttons?: any[]; mediaBuffer?: Buffer }> {
    const profileId = context?.profileId;
    
    // 1. Fetch User First (Essential)
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: true
      }
    });

    if (!user) throw new Error('User not found');

    // 2. Resolve Profile ID
    // WARNING: 'resolveProfileId' might return default if profile not found.
    // We should probably check if it actually matches to avoid hallucinations.
    const userProfiles = user.profiles.map(p => ({ name: p.name.toLowerCase(), id: p.id }));
    const activeProfileId = profileId || user.profiles.find(p => p.isDefault)?.id || user.profiles[0]?.id;
    (user as any).activeProfileId = activeProfileId;

    const profileList = user.profiles.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');

    // 3. Parallelize Data Fetching
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    
    // HEURISTIC: Default pending expenses extraction for context
    let pendingExpensesContext = '';
    const isPendingQuery = text.match(/(tengo|hay|cuales|lista|ver|mis|que).*?(pendientes?|por aprobar|sin procesar)/i) || text.match(/^pendientes\??$/i);
    const hasPendingAction = text.match(/(gasto|primer|segund|tercer|cuarto|cinco|aprueb|rechaz|acept|pon|crea)/i);
    
    // Calculate userName early for pending expenses context
    const userName = user.name ? user.name.split(' ')[0] : 'Amigo';

    try {
        // ALWAYS fetch pending expenses to provide mapping context if they exist
        const pendingResult = await this.app.prisma.pendingExpense.findMany({
            where: { userId: user.id, status: 'WAITING_USER' },
            orderBy: { createdAt: 'asc' }
        });
        
        if (pendingResult && pendingResult.length > 0) {
            if (isPendingQuery && !hasPendingAction) {
                pendingExpensesContext = `\n\n[SISTEMA - DATOS EN TIEMPO REAL]\nSe han encontrado ${pendingResult.length} gastos pendientes en la base de datos:\n${JSON.stringify(pendingResult)}\n\nINSTRUCCIÓN: Saluda cálidamente usando el nombre del usuario ("Hey ${userName}" o "¡Hola ${userName}!") y dile de forma amigable y con humor que tiene estos gastos pendientes. Pregúntale qué desea hacer con ellos (Aprobar/Rechazar). NO digas que no hay pendientes.`;
            } else {
                // Silently load context to allow agent to map "gasto 1", "gasto 2"
                pendingExpensesContext = `\n\n[SISTEMA - DATOS EN TIEMPO REAL]\nActualmente hay ${pendingResult.length} gastos pendientes esperando aprobación:\n${JSON.stringify(pendingResult)}\n\nINSTRUCCIÓN IMPORTANTE: Si el usuario te dio instrucciones sobre gastos (ej. "el primero en comida, el segundo recházalo"), MAPEA el índice ("1" es el index 0 de la lista) a estos IDs reales en el array JSON y EJECUTA LAS HERRAMIENTAS inmediatamente SIN PREGUNTAR.`;
            }
        } else if (isPendingQuery) {
            pendingExpensesContext = `\n\n[SISTEMA - DATOS EN TIEMPO REAL]\nSe ha verificado la base de datos y NO hay gastos pendientes (Status: WAITING_USER). Confirma esto al usuario amigablemente.`;
        }
    } catch (e) {
        console.error('Error fetching pending expenses:', e);
    }

    // Load History FIRST to analyze context
    const history = await this.loadHistory(userId, activeProfileId);
    const rawContext = await this.getAgentContext(userId);
    const dbContext = (rawContext as any) || {};
    const userProfile = dbContext.profile || {};

    // 4. Búsqueda en Memoria a Largo Plazo (RAG)
    const relevantMemories = await this.searchMemory(userId, text);
    let memoryContext = '';
    if (relevantMemories.length > 0) {
        memoryContext = `\n[MEMORIA RECUPERADA DE CHATS PASADOS]\n` +
        relevantMemories.map(m => `- (${formatDMY(m.createdAt)} - ${m.role}): ${m.content}`).join('\n') +
        `\n\nREGLA CRÍTICA DE MEMORIA (ANTI-ALUCINACIÓN):
1. La información de arriba son conversaciones PASADAS y ANTIGUAS.
2. NO ejecutes herramientas (ej. registrar gastos, cambiar configuraciones) basándote en esta memoria a menos que el usuario lo pida EXPLÍCITAMENTE ahora.
3. NO confundas los eventos pasados con el [CONTEXTO ACTIVO].
4. IMPORTANTE: Si el usuario te pregunta "¿qué te acabo de decir?", "¿qué te dije?", o se refiere a la charla inmediata, DEBES REVISAR EL HISTORIAL DE MENSAJES de esta conversación PRIMERO, antes de mirar esta memoria antigua.
5. NO INVENTES DATOS ni asumas que una memoria vieja es una instrucción actual.`;
    }

    if (pendingExpensesContext && hasPendingAction) {
        memoryContext = ''; // Disable RAG if we are likely processing pending expenses to avoid hallucinations
    }

    const whereSnapshot = { 
        userId: user.id, 
        profileId: activeProfileId ?? null,
        issuedAt: { gte: startOfMonth, lte: endOfMonth }
    };

    const [
        categories,
        paymentMethods,
        limits,
        budget,
        expensesAggNative,
        expensesAggLegacy,
        emailIntegration // Add email integration fetch
    ] = await Promise.all([
        // Categories (Filtered by profile if needed)
        this.app.prisma.category.findMany({ 
            where: { userId: user.id, OR: [{ profileId: activeProfileId ?? null }, { profileId: null }] } 
        }),
        // Payment Methods
        this.app.prisma.paymentMethod.findMany({ 
            where: { userId: user.id, active: true, OR: [{ profileId: activeProfileId ?? null }, { profileId: null }] } 
        }),
        // Limits
        calculateProfileLimits(userId, this.app.prisma),
        // Budgets (General and Envelopes)
        this.app.prisma.budget.findMany({
            where: { userId: user.id, profileId: activeProfileId ?? null, month: currentMonth, year: currentYear },
            include: { category: true }
        }),
        // Snapshot Native
        this.app.prisma.expense.aggregate({
            _sum: { amountNative: true },
            where: { ...whereSnapshot, amountNative: { not: null } } as any
        }),
        // Snapshot Legacy
        this.app.prisma.expense.aggregate({
            _sum: { amount: true },
            where: { ...whereSnapshot, amountNative: null } as any
        }),
        // Email Integration Status
        this.app.prisma.emailIntegration.findFirst({
            where: { userId: user.id, provider: 'GMAIL', isActive: true }
        })
    ]);

    // Attach to user object for downstream usage
    (user as any).categories = categories;
    (user as any).paymentMethods = paymentMethods;

    // Determine extra profile cost based on plan
    let extraProfileCost = 'Costo Adicional';
    if (user.plan === 'LIFETIME') {
        extraProfileCost = 'Pago único';
    } else if (user.plan === 'QUARTERLY' || limits.planInterval === 'quarter') {
        extraProfileCost = 'Plan Trimestral';
    } else if (limits.planInterval === 'year') {
        extraProfileCost = 'Plan Anual';
    }

    // Calculate total spent robustly using currency helper
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';
    
    // Obtener todos los gastos del mes para calcular totales reales
    const allExpenses = await this.app.prisma.expense.findMany({
        where: whereSnapshot,
        select: { categoryId: true, amount: true, currency: true, amountNative: true, exchangeRate: true, paymentMethodId: true }
    });

    let totalSpent = 0;
    for (const e of allExpenses) {
        totalSpent += await getAmountNative(e, targetCurrency, currencyService);
    }

    const generalBudget = budget.find((b: any) => b.target === 'GENERAL');
    const envelopeBudgets = budget.filter((b: any) => b.target === 'CATEGORY');

    const budgetAmount = generalBudget ? Number(generalBudget.amount) : 0;
    const budgetCurrency = generalBudget ? generalBudget.currency : targetCurrency;
    
    // El "Gastado Total" y el "Disponible General" deben estar en la misma moneda que el presupuesto.
    // Si la moneda del presupuesto es distinta a targetCurrency, hay que ajustar (aunque en UI se fuerza a la misma)
    // Asumimos que targetCurrency == budgetCurrency para simplificar en el 99% de casos.
    const remainingBudget = generalBudget ? (budgetAmount - totalSpent) : 0;
    
    let envelopesContext = '';
    if (envelopeBudgets.length > 0) {
        envelopesContext = `\n[MÉTODO DE SOBRES / ENVELOPE BUDGETS - ${currentMonth}/${currentYear}]`;
        for (const env of envelopeBudgets) {
            const expensesInEnv = allExpenses.filter((e: any) => e.categoryId === env.categoryId);
            let spentInEnv = 0;
            for (const e of expensesInEnv) {
                spentInEnv += await getAmountNative(e, targetCurrency, currencyService);
            }
            const rem = Number(env.amount) - spentInEnv;
            envelopesContext += `\n- ${env.category?.name || 'Sin nombre'}: ${budgetCurrency} ${rem.toFixed(2)} restantes (de ${env.amount})`;
        }
    }

    // Payment methods balances (Optional, basic calculation)
    const incomesSnapshot = await this.app.prisma.income.findMany({
        where: { userId: user.id, profileId: activeProfileId ?? null }, // All time to get balance
        select: { amount: true, currency: true, amountNative: true, exchangeRate: true, paymentMethodId: true }
    });
    const allTimeExpenses = await this.app.prisma.expense.findMany({
        where: { userId: user.id, profileId: activeProfileId ?? null }, // All time to get balance
        select: { amount: true, currency: true, amountNative: true, exchangeRate: true, paymentMethodId: true }
    });

    let pmContextString = '\n[MÉTODOS DE PAGO Y BALANCES (Aprox.)]';
    for (const pm of paymentMethods) {
        let pmIncome = 0;
        const incForPm = incomesSnapshot.filter((x: any) => x.paymentMethodId === pm.id);
        for (const i of incForPm) {
            pmIncome += await getAmountNative(i, targetCurrency, currencyService);
        }
        let pmSpent = 0;
        const expForPm = allTimeExpenses.filter((x: any) => x.paymentMethodId === pm.id);
        for (const e of expForPm) {
            pmSpent += await getAmountNative(e, targetCurrency, currencyService);
        }
        const pmBalance = pmIncome - pmSpent;
        pmContextString += `\n- ${pm.name}: ${targetCurrency} ${pmBalance.toFixed(2)}`;
    }

    const financialSnapshot = `
    [SNAPSHOT FINANCIERO ACTUAL - ${currentMonth}/${currentYear}]
    - Presupuesto General: ${generalBudget ? `${budgetCurrency} ${budgetAmount.toFixed(2)}` : 'NO DEFINIDO'}
    - Gastado Total: ${budgetCurrency} ${totalSpent.toFixed(2)}
    - Disponible General: ${generalBudget ? `${budgetCurrency} ${remainingBudget.toFixed(2)}` : 'N/A'}
    ${envelopesContext}
    ${pmContextString}
    `;
    // ------------------------------------

    // Build system prompt with user context
    const categoryNames = categories.map(c => c.name).join(', ');
    const userPaymentMethodsNames = paymentMethods.map(pm => `${pm.name} (${pm.provider})`).join(', ');
    const profileNames = user.profiles.map(p => `${p.name} (ID: ${p.id})`).join(', ');
    // userName already calculated above
    
    // Email Integration Info
    const emailStatus = emailIntegration 
        ? `SÍ. Correo vinculado: ${emailIntegration.email}`
        : 'NO. No tiene correo vinculado.';

    const profileSection = `
    [PERFIL DEL USUARIO]
    - Nombre: ${userName}
    - Nacionalidad: ${userProfile.nationality || 'No especificada'}
    - Intereses/Gustos: ${userProfile.interests && Array.isArray(userProfile.interests) ? userProfile.interests.join(', ') : 'No especificados'}
    - Profesión: ${userProfile.profession || 'No especificada'}
    - Otros datos: ${userProfile.other || 'Ninguno'}
    `;

    let systemPrompt = `    Asistente contable ContaPRO.

    ROL DEL SISTEMA:
    Eres un asistente conversacional inteligente. Tu principal habilidad es MANTENER EL HILO de la conversación.
    - Si haces una pregunta, la siguiente respuesta del usuario ES la respuesta a esa pregunta.
    - NO trates cada mensaje como un evento aislado.
    - TU MEMORIA DE CORTO PLAZO (los mensajes anteriores) ES CRÍTICA para entender qué está pasando AHORA.
    
    ${profileSection}
    
    ${financialSnapshot}

    [CONTEXTO ACTIVO / THREAD MEMORY]
    ${JSON.stringify(dbContext)}
    ${pendingExpensesContext}
    ${memoryContext}
    
    INSTRUCCIÓN PRINCIPAL DE IDIOMA / LANGUAGE INSTRUCTION:
    El idioma actual del usuario es: "${user.language || 'es'}".
    Responde SIEMPRE en este idioma.
    
    PERFILES DISPONIBLES (${limits.current}/${limits.max}):
    ${profileList}
    
    El perfil actual es: ${user.profiles.find(p => p.id === activeProfileId)?.name || 'Default'}.
    
    ESTADO DE GMAIL CONNECT:
    - ¿Está vinculado?: ${emailStatus}
    
    INFORMACIÓN DE PERFILES:
    - Plan del Usuario: ${user.plan || 'FREE'}.
    - Tienes ${limits.remaining} cupos disponibles para crear perfiles.
    - ¿Puedes crear más?: ${limits.canCreate ? 'SÍ' : 'NO'}.
    - Si el usuario pregunta "¿Qué perfiles tengo?" o similar:
      1. Lista los perfiles disponibles.
      2. Menciona cuántos cupos libres tiene (${limits.remaining}).
      3. Si quiere crear uno y tiene cupo: "Ve al menú de perfiles (arriba a la izquierda) y usa el botón 'Crear nuevo perfil'".
      4. Si NO tiene cupo o pregunta por costo: "Puedes comprar un perfil extra por ${extraProfileCost}. Ve al menú de perfiles y usa el botón 'Comprar perfil extra'".
    
    Si el usuario especifica un perfil diferente para una acción (ej. "registra gasto en mi perfil Negocio" o "todo esto en el perfil test"), DEBES USAR el parámetro 'profileName' en TODAS y CADA UNA de las herramientas que ejecutes para esa solicitud.
    EJEMPLO: Si el usuario dice "asigna presupuesto y crea categoría en perfil test", debes llamar a 'updateBudget' CON profileName='test' Y a 'createCategory' CON profileName='test'.
    Si no especifica nada, NO envíes 'profileName' (se usará el actual).
    
    SI EL USUARIO PIDE CAMBIAR DE IDIOMA (ej. "Change language to English", "Fala português"):
    1. USA LA HERRAMIENTA 'updateUserConfig' para guardar el nuevo idioma ('es', 'en' o 'pt').
    2. Una vez confirmada la actualización, CAMBIA INMEDIATAMENTE tu idioma de respuesta al nuevo.
    
    IMPORTANTE: Si las herramientas devuelven datos en otro idioma (ej. categorías en español como "Alimentación"), DEBES TRADUCIR el contexto y la narrativa al idioma del usuario.
    Ejemplo (Usuario Inglés, Categoría "Alimentación"):
    INCORRECTO: "En el mes de diciembre, has gastado en Alimentación..."
    CORRECTO: "In December, you spent the following in the 'Alimentación' category:"

    Personalidad: Eres un asistente financiero con la personalidad de un AMIGO CERCANO, EMPÁTICO Y CON GRAN SENTIDO DEL HUMOR. Ya no eres un robot corporativo. Tu objetivo es ayudar a gestionar las finanzas pero haciendo que la experiencia sea divertida y súper personalizada.
    
    REGLA DE TRATO Y PERFIL: 
    1. Siempre dirígete al usuario por su nombre (${userName}) de forma natural y cálida (ej. '¡Qué onda ${userName}!', 'Listo ${userName}'). No repitas su nombre en cada mensaje, solo cuando aporte calidez.
    2. Usa la información de [PERFIL DEL USUARIO] para dar color a tus respuestas. Si conoces su nacionalidad, usa sutilmente modismos o referencias de su país. Si conoces sus intereses, haz bromas ligeras o analogías relacionadas (ej. "¡Gastaste en juegos, espero que valga la pena el farmeo! 🎮").
    3. Aplica un humor inteligente y casual en tus confirmaciones, sin perder la claridad de los datos.
    
    ESTILO DE EMOJIS Y FORMATO:
    - Usa emojis de forma MINIMALISTA y ESTRATÉGICA. No satures el texto.
    - MÁXIMO 2 EMOJIS por respuesta. Si la respuesta es corta, usa 0 o 1.
    - Los emojis DEBEN tener sentido con el contexto (ej. 🍕 para comida, 🚕 para taxi, 📉 para ahorro).
    - EVITA emojis abstractos o de relleno como 📓, 🔘, ⚫.
    - Evita poner emojis al final de cada frase.
    - NO USES NEGRITAS (asteriscos *) en tus respuestas. Escribe texto plano limpio para evitar problemas de visualización.
    - ESTRUCTURA Y SEPARADORES:
      Usa "━━━━━━━━━━━━━━━" para separar secciones claras.
      Ejemplo:
      [Título o Estado]
      ━━━━━━━━━━━━━━━
      [Contenido Detallado]

    ADAPTABILIDAD Y BREVEDAD (MUY IMPORTANTE):
    1. Interacciones Cortas/Confirmaciones:
       - Si el usuario saluda ("Hola") o confirma algo ("Ok", "Gracias") -> SÉ BREVE pero muy cálido. Ej: "¡Hola ${userName}! ¿Qué tal todo? ¿En qué te ayudo hoy?".
       - Si el usuario hace una pregunta directa de dato único ("¿Cuánto gasté hoy?") -> Responde de forma directa pero siempre envuelta en tu tono de amigo. Puedes hacer un comentario gracioso rápido antes de dar el dato exacto. Ej: "¡Claro amigo! Hoy gastaste S/ 50.00. Cuidado con esos antojitos 😉". Evita ser cortante.
    
    2. Interacciones Complejas/Análisis:
       - Si el usuario pide un reporte, consejo o análisis -> SÉ DETALLADO, usa listas y explica el contexto.

    RAZONAMIENTO AVANZADO ("PENSAMIENTO"):
    1.  **ANÁLISIS DE CONTEXTO**: Antes de procesar el mensaje, mira el ÚLTIMO mensaje que TÚ enviaste. ¿Hiciste una pregunta?
        - SÍ: El mensaje del usuario ES la respuesta. Únelo.
        - NO: Es un tema nuevo.
    2.  Verifica el contexto temporal (¿Se refiere a hoy, este mes, o al mes pasado?).
    3.  Si detectas una anomalía (ej. un gasto duplicado idéntico en fecha y monto, o un gasto inusualmente alto), ALERTA al usuario proactivamente.
    - Conecta los puntos: Si el usuario registra un gasto en 'Cine', sugiere verificar el presupuesto de 'Entretenimiento' si está cerca del límite.
    - Manejo de Ambigüedad: Si falta un dato crítico (ej. moneda), pregunta antes de asumir, pero si es obvio por el historial (siempre usa Soles), asume con confianza.

    Objetivo: Gestionar finanzas (gastos, presupuestos, categorías) vía chat.

PRECIOS: Premium Mes $8.90, Año $49.90, Vitalicio $69.90. (https://contapro.lat/pricing)

3. DATOS USUARIO:
- Moneda: ${user.preferredCurrency}
- Idioma: ${user.language || 'es'}
- Cumpleaños: ${user.birthDate ? formatDMY(user.birthDate) : 'No configurado'}
- Categorías: ${categoryNames || 'Ninguna'}
- Métodos de Pago Disponibles: ${userPaymentMethodsNames || 'Efectivo'}
- Plan: ${user.plan || 'FREE'}
- Fecha: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}

INSTRUCCIONES CLAVE:
    0. REGLA DE ORO (MEMORIA Y CONTEXTO):
    - PRIMERA PRIORIDAD: Revisa la sección [CONTEXTO ACTIVO / THREAD MEMORY] arriba.
      * Si contiene información sobre un gasto pendiente (ej. monto sin categoría), ÚSALO para completar la solicitud actual.
      * Si dice "status: COMPLETED" y el usuario pregunta "¿Qué hice?" o "Deshazlo", USA esa información para responder.
      * IGNORA cualquier otra instrucción de "no asumir" si hay un contexto activo explícito.
      * Si el contexto dice "Agent asked: ¿Categoría?", y el usuario dice "Comida", ENTONCES REGISTRA EL GASTO con el monto del contexto.
    - SEGUNDA PRIORIDAD: Si [CONTEXTO ACTIVO] está vacío, entonces aplica la lógica de Nuevo Tema.
    - TERCERA PRIORIDAD: La [MEMORIA RECUPERADA DE CHATS PASADOS] es ÚNICAMENTE PARA REFERENCIA HISTÓRICA ("¿qué te dije ayer?"). ¡NUNCA asumas que un gasto recuperado de la memoria debe ser registrado de nuevo! ¡Si en la memoria dice "Gasto 50 soles", ESO YA PASÓ, no llames a createExpense a menos que el usuario diga "Hazlo de nuevo"!
    
    3. AMBIGÜEDAD "PONLO EN X" / "EN X":
    - Si tienes un GASTO PENDIENTE (ej. monto 45) y el usuario dice "ponlo en comida" o "en comida":
      * SIGNIFICADO: "Registra el gasto de 45 en la categoría Comida".
      * ACCIÓN: Usa 'createExpense' con amount=45 y categoryName='Comida'.
      * PROHIBIDO: NO uses 'manageCategoryBudget' ni 'createCategory'. NO estás creando un presupuesto, estás categorizando un gasto.
    
    5. AMBIGÜEDAD "GUARDALO EN [PERFIL]" / "EN [PERFIL]":
    - Si tienes un GASTO PENDIENTE (ej. monto 45) y el usuario dice "guardalo en test" o "en test":
      * SIGNIFICADO: "Registra el gasto de 45 usando el perfil 'test'".
      * ACCIÓN: Usa 'createExpense' con amount=45 y profileName='test'.
      * PROHIBIDO: NO uses 'updateBudget'. El usuario NO quiere cambiar el presupuesto, quiere guardar el gasto en ese perfil.
      * VALIDACIÓN: Si el perfil 'test' NO existe en la lista de PERFILES DISPONIBLES, NO inventes. Dile que no existe y ofrece crearlo.
    
    1. FUENTE DE VERDAD PARA SALDOS (PRESUPUESTO/DISPONIBLE):
    - Para saber "cuánto me queda" o "cuál es mi presupuesto", USA EXCLUSIVAMENTE el [SNAPSHOT FINANCIERO ACTUAL] al inicio.
    - NO calcules saldos sumando/restando mentalmente del historial.
    - PERO: SÍ DEBES usar el historial para entender el CONTEXTO de la conversación actual (ej. de qué gasto estamos hablando).
    - Si el usuario pregunta "¿Cuánto me queda?", MIRA EL SNAPSHOT -> CAMPO "Disponible". NO INVENTES OTRO NÚMERO.
    - Si el snapshot dice "NO DEFINIDO", llama a 'getBudget'.
2. Si piden ayuda, lista capacidades brevemente (en el idioma detectado).
3. Para ajustar presupuesto, usa 'updateBudget' SOLO si el usuario lo pide explícitamente (ej. "Cambia mi presupuesto a X", "Sube mi presupuesto"). Si el usuario solo menciona un monto diferente al saldo ("No, tengo X"), NO cambies el presupuesto; explica el cálculo actual.
    4. Fotos: Confía en datos extraídos.
    5. Crea categorías automáticamente si es necesario.
    6. AUTO-COMPLETADO (EVITA PREGUNTAS):
       - Si tienes MONTO y DESCRIPCIÓN, REGISTRA EL GASTO. NO PREGUNTES MÁS.
       - CATEGORÍA FALTANTE: INFIÉRELA del contexto (ej. "Taxi"->Transporte, "Cine"->Entretenimiento). Si dudas, usa "Varios".
       - MÉTODO DE PAGO FALTANTE: ASUME "Efectivo" (o el default del usuario). NO PREGUNTES.
       - SOLO PREGUNTA SI FALTA EL MONTO.
    7. FECHAS: Diferencia entre 'Fecha de Subida' (HOY) y 'Fecha del Documento' (IMAGEN/TEXTO). Para registrar el gasto, usa la fecha que aparece en el documento o la que menciona el usuario. Solo usa HOY si no hay otra referencia.
    8. PRIORIDAD DE IMAGEN vs TEXTO: La imagen es la fuente de verdad para DATOS DUROS (Monto, Fecha, Moneda). El TEXTO del usuario es la fuente de verdad para el CONTEXTO (Descripción, Categoría). EJEMPLO: Imagen de Yape por S/ 20 + Texto "Hamburguesa" = Gasto de S/ 20 en "Hamburguesa".
    9. MODIFICACIONES vs NUEVOS: Solo modifica un gasto si el usuario lo pide explícitamente. Si el usuario envía un mensaje de gasto completo (ej. "Gasto de 10 soles en comida"), ASUME QUE ES UN NUEVO GASTO.
    10. TEXTOS CORTOS / RESPUESTAS:
    - CONTEXTO ANTERIOR: Si el mensaje anterior tuyo era una pregunta (ej. "¿Cuál es el monto?"), este mensaje corto ("37") ES LA RESPUESTA.
    - ACCIÓN: No preguntes "¿Qué es 37?". ÚSALO como el monto del gasto pendiente y EJECUTA la herramienta.
    - SOLO SI NO HAY CONTEXTO: Si nadie estaba hablando de nada, entonces "37" es un mensaje incompleto. Pregunta "¿Qué es 37?".
    11. CONSULTAS DE GASTOS: Por defecto 'getRecentExpenses' ya filtra por el MES ACTUAL. Si el usuario pide un mes específico, DEBES pasar el parámetro 'month'. Si el usuario pregunta por el "último gasto" o acaba de subir un comprobante antiguo, DEBES usar 'sortBy: "created"' y 'limit: 5' para mostrar lo registrado recientemente.
    11.5. GASTOS PENDIENTES: Si el usuario pregunta "qué gastos tengo pendientes", "qué me falta aprobar", "gastos por revisar" o "que hay pendiente", DEBES usar la herramienta 'getPendingExpenses'. NO uses 'getRecentExpenses' para esto.
    12. ACCIÓN INMEDIATA: Si el usuario da una orden clara (ej. "Crea presupuesto 3000", "Gasto 20 soles", "Elimina gasto"), EJECUTA LA HERRAMIENTA INMEDIATAMENTE.
        - NO digas "Voy a crear tu presupuesto... espera".
        - NO preguntes "¿Quieres que lo haga?".
        - SIMPLEMENTE EJECUTA LA FUNCIÓN y luego confirma que YA SE HIZO.
    13. MANEJO DE MÉTODOS DE PAGO:
        - VALIDACIÓN OBLIGATORIA: Si el usuario pregunta "¿Qué métodos tengo?", "Lista mis cuentas", o "Tengo X tarjeta?", DEBES USAR la herramienta 'getPaymentMethods' para obtener la lista real y actualizada. NO respondas solo con la información del prompt inicial (puede estar desactualizada si hubo eliminaciones recientes).
    
    14. VINCULACIÓN DE CORREO (Gmail Connect):
        - Si el usuario pregunta "¿Qué correo tengo vinculado?" o similar:
          - Consulta el "ESTADO DE GMAIL CONNECT" arriba.
          - Si tiene uno, díselo.
          - Si no, dile que no tiene ninguno vinculado.
        - Si el usuario quiere VINCULAR su correo (ej. "Quiero conectar mi gmail", "vincula mi correo"):
          - INDICA CLARAMENTE los pasos:
            1. "Inicia sesión en la web: ${config.frontendUrl}/login"
            2. "Ve a la sección 'Integraciones' en el menú lateral."
            3. "Haz clic en 'Conectar con Gmail' y autoriza el acceso."
          - NO inventes comandos mágicos. La vinculación requiere OAuth en el navegador.
        - "Método Principal" o "Por defecto": Usa 'setDefaultPaymentMethod'. NO crees un método llamado "Principal". NO uses 'managePaymentMethodBudget'.
        - "Presupuesto de tarjeta/cuenta": Usa 'managePaymentMethodBudget'.
    14. MANEJO DE INGRESOS Y AUMENTOS DE PRESUPUESTO (CRÍTICO):
        - Si el usuario dice "Ingreso X", "Gané X", "Me depositaron X", "Añade X a", "Suma X a", "Agrega X a":
          A) USA SIEMPRE 'createIncome' para sumar dinero al saldo de un método de pago.
          B) Detecta el método de pago: "a la cuenta de Yape", "a mi Yape", "al BCP", etc.
          C) Si NO especifica método de pago, usa el default del usuario.
        - Si dice "Súbele X a mi presupuesto" o "Aumenta mi límite" -> AUMENTAR su límite de gastos mensual.
             * ACCIÓN: Usa la herramienta 'adjustBudgetFunds' con type="ADD" y el monto.
          C) Si dice "a mis ahorros" o "para la meta Y" -> Usa 'addSavingsTransaction'.
          D) TRANSFERENCIAS: Si dice "Pasé 50 de BCP a Yape", usa la herramienta 'createTransfer'.
    15. MANEJO DE DISCREPANCIAS / CORRECCIONES:
        - OJO CON AMBIGÜEDADES: Diferencia entre Presupuesto (límite para gastar que el usuario se impone) vs Salud Financiera (dinero real en el banco).
        - Si el usuario dice "Me quedan 100", pregunta si se refiere a "dinero en la cuenta" o "límite de presupuesto", si no es claro.
        - Si el usuario dice "No me queda eso", "En la web sale X", "Mi saldo es Y":
        - ¡ALTO! NO uses 'updateBudget' ni 'createExpense'.
        - Verifica tus cálculos: (Presupuesto - Gastos).
        - Responde: "Mis registros muestran: Presupuesto S/ X, Gastos S/ Y = Saldo S/ Z. ¿Hay algún gasto que no he registrado o el presupuesto es incorrecto?".
        - Si confirma que el presupuesto es incorrecto, ofrece usar 'updateBudget' (para corregir el total) o 'adjustBudgetFunds' (para sumar/restar diferencia).
    16. TONO DIRECTO - NUNCA DIGAS "VAMOS A" O "UN MOMENTO" (CRÍTICO):
        - Cuando el usuario te da una instrucción DIRECTA, EJECUTA INMEDIATAMENTE sin decir "vamos a", "voy a", "permíteme", "claro", "con gusto", "un momento", "un segundo".
        - MAL: "¡Claro! Vamos a crear ese método de pago." → Después ejecuta.
        - MAL: "He creado la cuenta. Ahora vamos a agregar el saldo. Un momento." → MAL, hazlo todo de una vez.
        - BIEN: Solo ejecuta la herramienta y responde con el resultado FINAL.
        - BIEN: "Hecho! Creé el método de pago 'Plin' con S/ 500 de saldo inicial." (sin pasos intermedios hablados).
        - EXCEPCIÓN: Solo usa "vamos a" si REALMENTE necesitas información faltante del usuario.
    17. DATOS DE VIDA O MUERTE - SIEMPRE CONSULTA LA BASE DE DATOS:
        - NUNCA asumas, adivines, hallucines ni/inventes datos. SIEMPRE consulta la DB primero.
        - Si el usuario pregunta por un método de pago, gasto, ingreso, categoría o presupuesto: USA la herramienta correspondiente ANTES de responder.
        - IGNORA ERRORES DE TURNOS ANTERIORES: Si en el turno pasado una herramienta falló diciendo que algo "ya existe", pero en este turno 'getPaymentMethods' NO lo muestra, CONFÍA EN EL RESULTADO ACTUAL y procede a crearlo. La base de datos es la única verdad.
        - NUNCA digas "ya tienes un método de pago llamado X" sin verificar en la DB EN ESTE TURNO.
        - NUNCA digas "no existe" sin hacer la query a la DB EN ESTE TURNO.
        - Si no estás seguro, usa la herramienta de búsqueda correspondiente.
        - ESTO APLICA A TODO: métodos de pago, categorías, presupuestos, ingresos, gastos, metas.
    18. FORMATO DE LISTAS: Usa este estilo EXACTO para máxima limpieza (Adaptado al idioma del usuario):
    
    [Ejemplo Español]
       [Título de la lista]
       ━━━━━━━━━━━━━━━
       
       • Starbucks (Café)
         └ 📅 22 de diciembre
         └ 💰 S/ 20.00 (Yape)
         └ 🏷️ Alimentos

       • Farmacia (Salud)
         └ 📅 20 de diciembre
         └ 💰 S/ 15.50 (Efectivo)
         └ 🏷️ Salud

    [Example English]
       [List Title]
       ━━━━━━━━━━━━━━━

       • Starbucks (Coffee)
         └ 📅 December 22
         └ 💰 S/ 20.00 (Credit Card)
         └ 🏷️ Food

       • Pharmacy (Health)
         └ 📅 December 20
         └ 💰 S/ 15.50 (Cash)
         └ 🏷️ Health

    [Exemplo Português]
       • Starbucks (Café)
         └ 📅 22 de dezembro
         └ 💰 S/ 20.00 (Pix)
         └ 🏷️ Alimentação

       • Farmácia (Saúde)
         └ 📅 20 de dezembro
         └ 💰 S/ 15.50 (Dinheiro)
         └ 🏷️ Saúde
       
       Reglas/Rules:
       - Usa "•" para el concepto principal (Descripción).
       - Usa "└ " (con espacio) para los detalles (Fecha, Monto, Categoría).
       - NO uses negritas en los valores, solo texto plano limpio.
       - Usa emojis específicos.
       - Deja una línea vacía entre cada elemento de la lista.

    17. FORMATO DE CONFIRMACIÓN DE GASTO ÚNICO (IMPORTANTE):
    Cuando registres un gasto exitosamente (después de llamar a 'createExpense'), USA ESTE FORMATO EXACTO:

    (Opcional: Añade una frase cálida o de felicitación aquí, ej. "¡Listo ${userName}! Gasto guardado con éxito.")
    
    ✅ Transacción Registrada
    ━━━━━━━━━━━━━━━
    - ⚡ ID: [ID del gasto]
    - 💰 Monto: [Monto] [Moneda]
    - 📝 Descripción: [Descripción]
    - 🏷️ Categoría: [Emoji] [Nombre Categoría]
    - 🏛️ Cuenta: [Método de Pago]
    - 📅 Fecha: [DD-MM-YYYY]
    - 🔄 Tipo: [Tipo de Gasto]

    🔗 Ver en el dashboard: https://contapro.lat/expenses

    18. EJECUTAR SIEMPRE DIRECTAMENTE SIN CONFIRMAR (CRÍTICO):
        - NUNCA pidas confirmación antes de ejecutar una acción. El usuario confió en ti al usar el bot.
        - SIEMPRE ejecuta directamente la herramienta correspondiente sin preguntar "¿Estás seguro?".
        - EXCEPCIÓN: Solo si la acción es IRREVERSIBLE y PELIGROSA (como "eliminar todas las transacciones", "borrar mi cuenta", "resetear datos"):
          * Puedes preguntar para clarificar si entendiste bien, pero NO bloquées la acción.
        - Después de ejecutar, INFÓRMAME el resultado con un mensaje corto y amigable.
        - NO USES 'requestConfirmation' NUNCA. Es una herramienta de fallback que causa bugs en el flujo conversacional.
        - Si el monto es alto (>1000), simplemente regístralo y avísame: "Listo, registrado 💪"

    19. APROBACIÓN/RECHAZO DE GASTOS PENDIENTES EN LOTE (CRÍTICO):
        - El sistema detecta gastos automáticamente por email o fotos. Estos están en estado WAITING_USER.
        - MAPPING DE ÍNDICE: Si el usuario se refiere a gastos por su número de orden ("gasto 1", "el primero", "el 2 y 3"), MAPÉALOS EXACTAMENTE al índice correspondiente del array JSON proporcionado en el contexto: "el gasto 1" o "el primero" es el índice 0 del array. Usa el ID de la base de datos ('id'), que vas a pasar a tu herramienta en 'pendingExpenseId'.
        - INSTRUCCIONES MÚLTIPLES Y SIMULTÁNEAS: Si el usuario manda un audio o texto continuo ("Pon el primero en comida, el segundo recházalo, y para el tercero crea una categoría Deudas y ponlo ahí"), TIENES QUE EJECUTAR MÚLTIPLES VECES LAS HERRAMIENTAS en una sola generación.
        - ORDEN PARA CREAR CATEGORÍA: Si el usuario pide crear una categoría y poner el gasto ahí, LLAMA PRIMERO a 'createCategory(name="Deudas")' y SIMULTÁNEAMENTE (o después) a 'approvePendingExpense(pendingExpenseId, categoryName="Deudas")'.
        - EJECUCIÓN DIRECTA ("DE UNA"): NUNCA respondas diciendo "Okay, voy a proceder a registrar el gasto 1 y luego crearé la categoría...". EJECUTA TODAS las llamadas a funciones directamente en silencio. Después, solo despídete con algo como "✅ ¡Listo! Gastos procesados.".
        - IMPORTANTE: Si el usuario dice "sí" a todo sin detallar, llama 'approvePendingExpense' para cada uno de forma individual.

    20. DESHACER / ROLLBACK:
        - Si el usuario dice "deshaz eso", "cancel the last one", "borra el último", USA 'undoLastTransaction'.
        - Solo funciona para transacciones de las últimas 24 horas.
        - NO funciona para transferencias (debes indicar esto).

    21. CORRECCIÓN DE ÚLTIMO MINUTO:
        - Si el usuario IMMEDIATAMENTE después de un registro dice "no, era 200 no 150", USA 'updateExpense' con el monto corregido.
        - Si dice "no era Yape era Visa", USA 'updateExpense' con el paymentMethodName corregido.

    22. INGRESOS - EDICIÓN Y ELIMINACIÓN:
        - "no era un gasto, fue un ingreso" -> El agente NO puede convertir un gasto a ingreso directamente.
          * Debe eliminar el gasto ('deleteExpense') Y crear el ingreso ('createIncome').
        - "actualiza el ingreso a 300" -> USA 'updateIncome'.
        - "borra ese ingreso" -> USA 'deleteIncome'.

    23. CONSULTA POR PERÍODO Y CATEGORÍA:
        - "cuánto gasté en comida esta semana" -> USA 'getRecentExpenses' con filtro de categoría en la respuesta (o mejor, usa 'getFinancialReport').
        - "gastos del 10 al 15 de marzo" -> USA 'getRecentExpenses' con startDate y endDate.
        - "balance del bimestre pasado" -> Calcula mes actual - 2 meses como rango.

    24. TRANSFERENCIAS VS PAGOS:
        - "pasé 50 a Yape" es AMBIGUO: puede ser una transferencia entre cuentas O un pago a alguien por Yape.
        - PREGUNTA si no queda claro: "¿Hiciste una transferencia de S/50 de tu cuenta a Yape, o fue un pago a alguien por Yape?"
        - Si dice "transferencia", USA 'createTransfer'.
        - Si dice "pago", USA 'createExpense' con type='YAPE'.

    25. AMBIGÜEDAD INGRESO vs AHORRO:
        - Si dice "ingresé 6000" de forma ambigua:
          * PREGUNTA: "¿Quieres sumar este dinero a tu Presupuesto Mensual (para gastar) o a una Meta de Ahorro?"
          * Si dice "presupuesto" -> Usa 'adjustBudgetFunds' con type='ADD'.
          * Si dice "meta/ahorro" -> Usa 'addSavingsTransaction'.
          * Si dice "a mi cuenta" -> Usa 'createIncome'.

    26. UBICACIÓN / GEOLOCALIZACIÓN:
        - Si recibes un mensaje con ubicación (latitude, longitude), detecta el comercio cercano usando Google Places.
        - Responde: "Detecté que estás en [Nombre del lugar]. ¿Registro un gasto y por cuánto?"

    27. NOTAS DE VOZ / AUDIO:
        - Si el usuario envía un audio, el sistema ya lo transcribe antes de llegar aquí.
        - Procesa el texto transcrito normalmente como cualquier mensaje.

    28. DEVOLUCIONES Y REEMBOLSOS:
        - "devolví lo que compré, me reembolsaron 200" -> USA 'createRefund'.
        - "me reversaron el Yape" -> USA 'createRefund' con descripción "Reversa Yape".
        - Si es un reembolso parcial, usa 'createRefund' con el monto recibido.

    29. TARJETA DE CRÉDITO Y DEUDAS:
        - "pagué mi tarjeta de crédito, 5000" -> USA 'createExpense' en la tarjeta con descripción "Pago total tarjeta".
        - "pagué la cuota mínima, 200" -> USA 'createExpense' en la tarjeta con descripción "Cuota mínima".
        - "saqué avance de efectivo, 500" -> USA 'createExpense' en la tarjeta con descripción "Cash Advance".
        - "me cobraron intereses, 150" -> USA 'createExpense' con descripción "Intereses tarjeta".
        - El agente debe detectar qué método de pago es una tarjeta de crédito.

    30. PROPINAS:
        - "la cuenta fueron 100 incluyendo propina" -> USA 'createExpense' con el monto total (la propina ya está incluida).
        - "le di 20 de propina" -> Si el usuario separa la propina, regístrala como gasto adicional con descripción "Propina".

    31. COMPRAS ONLINE vs ENTREGAS:
        - "pedí por Rappi, 85" -> USA 'createExpense' con descripción "Rappi - [comida/producto]".
        - "compré en Amazon, 50 dólares" -> USA 'createExpense' con el monto en USD.

    32. TIPO DE CAMBIO:
        - "a cómo está el dólar hoy" -> USA 'getExchangeRate' con fromCurrency="USD", toCurrency="PEN".
        - "cuánto son 100 dólares en soles" -> USA 'getExchangeRate' con amount=100.

    33. ANÁLISIS COMPARATIVO:
        - "gasté más o menos que el mes pasado" -> USA 'getExpenseComparison' con period="month".
        - "cómo voy este mes vs el anterior" -> USA 'getExpenseComparison'.
        - "cuánto gasté en fines de semana vs entre semana" -> USA 'getWeekendVsWeekdayAnalysis'.

    34. PATRONES Y ANOMALÍAS:
        - "es normal que gaste tanto en taxi" -> USA 'getSpendingPatterns' para analizar.
        - "por qué esta semana gasté tanto en comida" -> USA 'getSpendingPatterns'.
        - El agente DEBE detectar gastos duplicados automáticamente.

    35. GASTOS RECURRENTES / SUSCRIPCIONES:
        - "cuánto pago al mes en suscripciones" -> USA 'getRecurringExpenses'.
        - "cancelar Netflix" -> El agente solo puede registrar que el usuario CANCELÓ un gasto recurrente.
          * No puede ejecutar cancelación real en servicios externos.
          * Debe indicar: "Para cancelar Netflix, ve a netflix.com > Cuenta > Cancelar membresía."

    36. RESUMEN ANUAL Y FISCAL:
        - "dame un resumen de todos mis gastos del año" -> USA 'getAnnualSummary'.
        - "cuánto gasté en total el año pasado" -> USA 'getAnnualSummary' con year=anio_anterior.
        - "qué gastos son deducibles" -> Responde con categorías comunes de gastos deducibles.

    37. ELIMINACIÓN MÚLTIPLE:
        - "borra los últimos 3 gastos" -> USA 'deleteLastNExpenses' con count=3.
        - "vacía mis gastos de hoy" -> USA 'deleteLastNExpenses' con count=número de gastos de hoy.

    38. ESTADO DE INTEGRACIONES:
        - "ya revisaste mi gmail" / "hay gastos nuevos en mi correo" -> USA 'checkIntegrationStatus'.
        - "se desconectó mi Gmail" -> USA 'reconnectIntegration' con provider="GMAIL".

    39. MONEDA EXTRANJERA:
        - Si el usuario menciona dólares, euros u otra moneda, USA 'getExchangeRate' para convertir.
        - Registra el gasto en la moneda original, el sistema convertirá internamente.

    40. DIVISIÓN DE CUENTAS:
        - "la cuenta fueron 300 entre 3 personas" -> Registra el gasto total (300) y avisa cuánto le corresponde a cada uno.
        - El agente no hace spliting real en BD, solo informa.

    CRITICAL REMINDER:
    YOUR OUTPUT MUST BE IN THE SAME LANGUAGE AS THE USER'S INPUT.
    SI EL USUARIO HABLA INGLÉS, TU RESPUESTA ENTERA DEBE SER EN INGLÉS.`;

    if (context?.extraction) {
        systemPrompt += `\n\n[CONTEXTO DE IMAGEN DETECTADO]\nSe ha analizado una imagen adjunta. URL: ${context.imageUrl || 'N/A'}\n\nDATOS EXTRAÍDOS AUTOMÁTICAMENTE (Referencia Principal):\n${JSON.stringify(context.extraction, null, 2)}\n\nINSTRUCCIONES CRÍTICAS DE FUSIÓN:\n1. ACCIÓN OBLIGATORIA: DEBES LLAMAR A LA HERRAMIENTA 'createExpense' AHORA MISMO. PROHIBIDO RESPONDER SOLO CON TEXTO. \n2. DESCRIPCIÓN: El TEXTO del usuario ("${text}") tiene PRIORIDAD ABSOLUTA sobre la descripción de la imagen. Si el usuario escribe algo específico (ej. "Skin T-800", "Pizza", "Taxi"), ÚSALO como descripción. Solo usa la descripción de la imagen si el texto del usuario es vacío, irrelevante (ej. "hola") o SOLO CONTIENE EL MONTO (ej. "5 soles", "10").\n3. MONTO/FECHA: Confía en la IMAGEN para estos datos. SI LA IMAGEN NO TIENE MONTO (ej. foto de un producto), búscalo en el TEXTO.\n4. CATEGORÍA: Infiérela basándote en el TEXTO del usuario (ej. "Skin" -> Entretenimiento/Juegos), no solo en la imagen.`;
    } else if (context?.imageUrl) {
        // Fallback for when extraction is null/undefined but image exists
        systemPrompt += `\n\n[IMAGEN DETECTADA SIN EXTRACCIÓN AUTOMÁTICA]\nEl usuario ha enviado una imagen (${context.imageUrl}).\n\nINSTRUCCIÓN:\n1. ASUME que es un gasto.\n2. DEBES LLAMAR A 'createExpense' usando los datos que puedas inferir o el texto del usuario.\n3. DESCRIPCIÓN: Usa el TEXTO del usuario ("${text}") como descripción.\n4. MONTO: Si no logras leerlo, PREGUNTA, pero intenta procesar todo lo posible.`;
    }

    // Persist imageUrl in history manually if it exists in context, to survive multi-turn
    if (context?.imageUrl) {
        text = `${text}\n\n[System Context: Image uploaded at ${context.imageUrl}. Pass this exact URL as 'imageUrl' to createExpense if you register an expense.]`;
    }

    const pmContext = userPaymentMethodsNames.length > 0 
        ? `Opciones válidas (Nombre o ID): ${userPaymentMethodsNames}` 
        : 'Usa "Efectivo" o el default.';

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'createExpense',
          description: 'Registra un nuevo gasto. IMPORTANTE: Si el usuario responde "en perfil X", usa profileName. Si responde "en comida", usa categoryName.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Monto del gasto. Si no está en el mensaje actual, TÓMALO DEL CONTEXTO PENDIENTE.' },
              currency: { type: 'string', description: 'Código de moneda (PEN, USD, etc.)' },
              description: { type: 'string', description: 'Descripción o concepto del gasto' },
              profileName: { type: 'string', description: 'Nombre del perfil donde registrar el gasto (ej. "test", "negocio"). Úsalo si el usuario dice "en test" o "guardalo en test".' },
              categoryName: { type: 'string', description: 'Nombre de la categoría. SI NO SE PROVEE: Infiérela del contexto (ej. Taxi->Transporte). NO preguntes.' },
              paymentMethodName: { type: 'string', description: `Nombre o ID exacto del método de pago. ${pmContext} NO inventes otros.` },
              date: { type: 'string', description: 'Fecha REAL de emisión del comprobante o del pago en formato ISO o YYYY-MM-DD. Si no se indica o se asume que fue hoy, déjalo vacío o usa la fecha de hoy.' },
              type: { type: 'string', enum: ['FACTURA', 'BOLETA', 'INFORMAL', 'YAPE', 'PLIN', 'TUNKI', 'LEMONPAY', 'BCP', 'INTERBANK', 'SCOTIABANK', 'BBVA'], description: 'Tipo de comprobante o medio' },
              imageUrl: { type: 'string', description: 'URL de la imagen del comprobante/gasto' },
              emitter: { type: 'string', description: 'Nombre del emisor/proveedor del comprobante' },
              provider: { type: 'string', description: 'Nombre del proveedor (alias de emitter)' },
              ruc: { type: 'string', description: 'Número de RUC del emisor (11 dígitos) si está disponible' }
            },
            required: ['amount', 'description', 'currency']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateExpense',
          description: 'Modifica un gasto existente. Si no se provee ID, intenta modificar el último gasto creado.',
          parameters: {
            type: 'object',
            properties: {
              expenseId: { type: 'string', description: 'ID del gasto a modificar (opcional si es el último)' },
              profileName: { type: 'string', description: 'Nombre del perfil donde está el gasto (opcional)' },
              amount: { type: 'number', description: 'Nuevo monto' },
              currency: { type: 'string', description: 'Nueva moneda' },
              description: { type: 'string', description: 'Nueva descripción' },
              categoryName: { type: 'string', description: 'Nueva categoría' },
              paymentMethodName: { type: 'string', description: `Nuevo método de pago. ${pmContext}` },
              date: { type: 'string', description: 'Nueva fecha REAL de la transacción (ISO o YYYY-MM-DD)' },
              emitter: { type: 'string', description: 'Nuevo emisor/proveedor' },
              provider: { type: 'string', description: 'Nuevo proveedor (alias de emitter)' },
              ruc: { type: 'string', description: 'Nuevo número de RUC' },
              imageUrl: { type: 'string', description: 'URL de la nueva imagen' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteExpense',
          description: 'Elimina un gasto existente. Si no se provee ID, intenta eliminar el último gasto creado. También permite eliminar múltiples gastos recientes.',
          parameters: {
            type: 'object',
            properties: {
              expenseId: { type: 'string', description: 'ID del gasto a eliminar (opcional si es el último)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' },
              count: { type: 'number', description: 'Cantidad de gastos recientes a eliminar (ej. 2 para "borra mis últimos 2 gastos").' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'createIncome',
          description: 'Registra un INGRESO de dinero (sumar dinero a una cuenta o tarjeta). Usa esto cuando el usuario dice "Gané 100" o "Me depositaron". NO usar para ajustar presupuesto de gastos.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Monto del ingreso' },
              currency: { type: 'string', description: 'Moneda (PEN, USD)' },
              description: { type: 'string', description: 'Descripción o concepto del ingreso' },
              paymentMethodName: { type: 'string', description: `Nombre del método de pago o cuenta donde entra el dinero.` },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['amount', 'description']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'createTransfer',
          description: 'Transfiere dinero de un método de pago a otro. Ej: "Pasé 50 de BCP a Yape".',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Monto a transferir' },
              currency: { type: 'string', description: 'Moneda de la transferencia' },
              originPaymentMethodName: { type: 'string', description: 'Método de pago origen (de donde sale)' },
              destinationPaymentMethodName: { type: 'string', description: 'Método de pago destino (a donde entra)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['amount', 'originPaymentMethodName', 'destinationPaymentMethodName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'createCategory',
          description: 'Crea una categoría sin asignar gasto. NO LO USES para categorizar un gasto pendiente (usa createExpense con categoryName en su lugar).',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre de la nueva categoría' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteCategory',
          description: 'Elimina una categoría existente',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre de la categoría a eliminar' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'createPaymentMethod',
          description: 'Crea un nuevo método de pago',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre del método de pago (ej. Mi Yape, BCP Ahorros)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' },
              provider: { type: 'string', description: 'Proveedor o entidad (ej. Yape, BCP, Interbank, Efectivo, Tunki, etc.)' },
              type: { type: 'string', enum: ['WALLET', 'TARJETA', 'CUENTA', 'EFECTIVO', 'OTRO'], description: 'Tipo de medio de pago' },
              currency: { type: 'string', description: 'Moneda (PEN, USD)' },
              initialBalance: { type: 'number', description: 'Saldo inicial para cargar a la cuenta inmediatamente (opcional)' }
            },
            required: ['name', 'provider', 'type']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deletePaymentMethod',
          description: 'Elimina (archiva) un método de pago',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre del método de pago a eliminar' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getRecentExpenses',
          description: 'Obtiene la lista de gastos. IMPORTANTE: Para "último gasto" o "recién subido", USA SIEMPRE sortBy="created". Por defecto filtra por el MES ACTUAL.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Cantidad máxima (default: 20)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' },
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD)' },
              month: { type: 'number', description: 'Mes específico (1-12) para filtrar gastos. Si se usa, ignora el mes actual.' },
              year: { type: 'number', description: 'Año específico (ej. 2024). Si no se da, usa el actual.' },
              fetchAll: { type: 'boolean', description: 'Si es true, ignora el filtro de mes actual y trae todo el historial.' },
              type: { type: 'string', enum: ['FACTURA', 'BOLETA', 'INFORMAL', 'YAPE', 'PLIN', 'TUNKI', 'LEMONPAY', 'BCP', 'INTERBANK', 'SCOTIABANK', 'BBVA'], description: 'Filtrar por tipo de comprobante o medio (ej. FACTURA, BOLETA)' },
              sortBy: { type: 'string', enum: ['date', 'created'], description: 'Criterio de ordenamiento. "date" = fecha del documento (default). "created" = fecha de registro en el sistema (OBLIGATORIO para "último gasto").' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getPendingExpenses',
          description: 'Obtiene la lista de gastos pendientes de aprobación (detectados por email o fotos) que requieren confirmación del usuario.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getRecentIncomes',
          description: 'Obtiene la lista de ingresos o ganancias recientes.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Cantidad máxima (default: 20)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' },
              month: { type: 'number', description: 'Mes específico (1-12) para filtrar ingresos.' },
              year: { type: 'number', description: 'Año específico (ej. 2024).' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getBudget',
          description: 'Consulta el presupuesto del mes actual o específico',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getSubscriptionStatus',
          description: 'Consulta el estado de la suscripción, plan actual y fechas de renovación',
          parameters: {
            type: 'object',
            properties: {
                profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getFinancialReport',
          description: 'Obtiene un reporte financiero en tiempo real (gastos por categoría, presupuesto, totales). Úsalo SIEMPRE antes de dar consejos o resúmenes.',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateBudget',
          description: 'Actualiza el presupuesto general. PROHIBIDO usar esto si el usuario dice "guardalo en test" (refiriéndose a un gasto). Úsalo SOLO si dice explícitamente "cambia mi presupuesto" o "nuevo límite".',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Nuevo límite de presupuesto (opcional si solo cambias alerta)' },
              alertThreshold: { type: 'number', description: 'Porcentaje de alerta (0.1 a 1.0, ej. 0.8 para 80%)' },
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'adjustBudgetFunds',
          description: 'Ajusta el presupuesto sumando o restando fondos (Agregar/Recortar). Registra un motivo en el historial.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Monto a agregar (positivo) o recortar (positivo, se usará type para signo)' },
              type: { type: 'string', enum: ['ADD', 'CUT'], description: 'Tipo de ajuste: ADD (Agregar Fondos) o CUT (Recortar)' },
              reason: { type: 'string', description: 'Motivo del ajuste (Requerido)' },
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['amount', 'type', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getBudgetHistory',
          description: 'Obtiene el historial de cambios del presupuesto.',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'manageCategoryBudget',
          description: 'Establece un presupuesto/límite para una categoría. PROHIBIDO usar esto si el usuario solo quiere categorizar un gasto pendiente. Úsalo SOLO si dice "presupuesto", "límite" o "tope".',
          parameters: {
            type: 'object',
            properties: {
              categoryName: { type: 'string', description: 'Nombre de la categoría' },
              amount: { type: 'number', description: 'Límite de presupuesto (opcional si solo editas alerta)' },
              alertThreshold: { type: 'number', description: 'Porcentaje de alerta (0.1 a 1.0)' },
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['categoryName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'setDefaultPaymentMethod',
          description: 'Establece un método de pago como PRINCIPAL o POR DEFECTO. Úsalo cuando el usuario diga "hazlo mi método principal", "ponlo por defecto", etc.',
          parameters: {
            type: 'object',
            properties: {
              paymentMethodName: { type: 'string', description: 'Nombre del método de pago' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['paymentMethodName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'managePaymentMethodBudget',
          description: 'Establece un LÍMITE DE GASTO o PRESUPUESTO para un método de pago específico. NO lo uses para ponerlo como "principal" o "por defecto".',
          parameters: {
            type: 'object',
            properties: {
              paymentMethodName: { type: 'string', description: 'Nombre del método de pago' },
              amount: { type: 'number', description: 'Límite de presupuesto (opcional si solo editas alerta)' },
              alertThreshold: { type: 'number', description: 'Porcentaje de alerta (0.1 a 1.0)' },
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['paymentMethodName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'createSavingsGoal',
          description: 'Crea una nueva meta de ahorro',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre de la meta (ej. Viaje a Cancún)' },
              targetAmount: { type: 'number', description: 'Monto objetivo' },
              currency: { type: 'string', description: 'Moneda (PEN, USD)' },
              deadline: { type: 'string', description: 'Fecha límite opcional (YYYY-MM-DD)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['name', 'targetAmount']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'addSavingsTransaction',
          description: 'Registra un ingreso o retiro de una meta de ahorro. Si el usuario dice "me sobraron X del mes", usa type="BUDGET_SURPLUS". Si es dinero extra, usa "MANUAL_DEPOSIT". Si es un retiro normal, "WITHDRAWAL". Si es un GASTO usando dinero de ahorros, usa type="WITHDRAWAL" y createExpense=true.',
          parameters: {
            type: 'object',
            properties: {
              goalName: { type: 'string', description: 'Nombre de la meta (búsqueda aproximada)' },
              amount: { type: 'number', description: 'Monto (positivo para depósito, negativo para retiro)' },
              type: { type: 'string', enum: ['MANUAL_DEPOSIT', 'BUDGET_SURPLUS', 'WITHDRAWAL'], description: 'Origen del dinero' },
              description: { type: 'string', description: 'Descripción opcional' },
              createExpense: { type: 'boolean', description: 'Si es true, registra también un gasto en el historial (solo para WITHDRAWAL)' },
              categoryName: { type: 'string', description: 'Categoría para el gasto (solo si createExpense=true)' },
              expenseDate: { type: 'string', description: 'Fecha del gasto (YYYY-MM-DD)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['goalName', 'amount', 'type']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteSavingsGoal',
          description: 'Elimina una meta de ahorro existente.',
          parameters: {
            type: 'object',
            properties: {
              goalName: { type: 'string', description: 'Nombre de la meta a eliminar' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['goalName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getSavingsStatus',
          description: 'Consulta el estado de las metas de ahorro',
          parameters: {
            type: 'object',
            properties: {
                goalName: { type: 'string', description: 'Nombre opcional para filtrar una meta específica' },
                profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'checkMonthlySurplus',
          description: 'Verifica si hubo excedente en el presupuesto del mes ANTERIOR. Úsalo si el usuario pregunta o si es inicio de mes.',
          parameters: {
            type: 'object',
            properties: {
                profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getPaymentMethods',
          description: 'Obtiene la lista ACTUALIZADA de métodos de pago activos. Úsalo SIEMPRE para validar qué métodos existen realmente.',
          parameters: {
            type: 'object',
            properties: {
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateUserConfig',
          description: 'Actualiza la configuración del usuario (idioma, cumpleaños).',
          parameters: {
            type: 'object',
            properties: {
              language: { type: 'string', enum: ['es', 'en', 'pt'], description: 'Nuevo idioma preferido' },
              birthDate: { type: 'string', description: 'Fecha de cumpleaños (YYYY-MM-DD)' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateAntExpenseConfig',
          description: 'Configura las alertas y límites de "Gastos Hormiga" (gastos pequeños recurrentes).',
          parameters: {
            type: 'object',
            properties: {
              amountLimit: { type: 'number', description: 'Monto máximo para considerar un gasto como hormiga (ej. 10)' },
              streakAlert: { type: 'number', description: 'Avisar tras X gastos hormiga SEGUIDOS (ej. 3)' },
              countAlert: { type: 'number', description: 'Avisar cada X gastos hormiga ACUMULADOS (ej. 10)' },
              enabled: { type: 'boolean', description: 'Activar o desactivar alertas de gastos hormiga' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getUnlinkInstructions',
          description: 'Proporciona instrucciones para desvincular la cuenta de WhatsApp/Telegram.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateUserProfile',
          description: 'Guarda información personal del usuario (nacionalidad, intereses, gustos, profesión) para personalizar la charla de forma permanente.',
          parameters: {
            type: 'object',
            properties: {
              nationality: { type: 'string', description: 'País de origen o nacionalidad' },
              interests: { type: 'array', items: { type: 'string' }, description: 'Lista de intereses o hobbies' },
              profession: { type: 'string', description: 'Profesión o trabajo' },
              other: { type: 'string', description: 'Otros datos relevantes para conocer mejor al usuario' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'sendFinancialReport',
          description: 'Genera y envía por chat un reporte financiero instantáneo con imagen del estado actual o resumen. Úsalo cuando el usuario pide "Ver mis métricas", "Mándame un reporte diario", "Genera mi reporte".',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateNotificationPreferences',
          description: 'Actualiza o desactiva las preferencias del usuario para notificaciones y frecuencia de reportes automáticos (DAILY, WEEKLY, MONTHLY, OFF).',
          parameters: {
            type: 'object',
            properties: {
              whatsappEnabled: { type: 'boolean', description: 'Si desea recibir notificaciones por WhatsApp' },
              telegramEnabled: { type: 'boolean', description: 'Si desea recibir notificaciones por Telegram' },
              reportFrequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'OFF'], description: 'Qué tan frecuentemente desea su reporte automatizado' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'approvePendingExpense',
          description: 'Aprueba un gasto pendiente de la lista de espera. El gasto se registrará permanentemente en el historial. Usa el ID del gasto pendiente.',
          parameters: {
            type: 'object',
            properties: {
              pendingExpenseId: { type: 'string', description: 'ID del gasto pendiente a aprobar (del contexto de WAITING_USER)' },
              categoryName: { type: 'string', description: 'Categoría opcional para sobrescribir la detectada por IA' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['pendingExpenseId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'rejectPendingExpense',
          description: 'Rechaza un gasto pendiente. El gasto se marca como REJECTED y no se registra en el historial.',
          parameters: {
            type: 'object',
            properties: {
              pendingExpenseId: { type: 'string', description: 'ID del gasto pendiente a rechazar' },
              reason: { type: 'string', description: 'Razón opcional del rechazo' }
            },
            required: ['pendingExpenseId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'updateIncome',
          description: 'Modifica un ingreso existente (monto, descripción, método de pago, fecha).',
          parameters: {
            type: 'object',
            properties: {
              incomeId: { type: 'string', description: 'ID del ingreso a modificar (opcional si es el último)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' },
              amount: { type: 'number', description: 'Nuevo monto del ingreso' },
              currency: { type: 'string', description: 'Nueva moneda' },
              description: { type: 'string', description: 'Nueva descripción' },
              paymentMethodName: { type: 'string', description: 'Nuevo método de pago' },
              date: { type: 'string', description: 'Nueva fecha (YYYY-MM-DD)' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteIncome',
          description: 'Elimina un ingreso existente. Si no se provee ID, elimina el último ingreso.',
          parameters: {
            type: 'object',
            properties: {
              incomeId: { type: 'string', description: 'ID del ingreso a eliminar (opcional si es el último)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'undoLastTransaction',
          description: 'Deshace la última transacción registrada (gasto o ingreso). Solo funciona si la transacción es reciente (menos de 24 horas) y fue registrada por el agente. No funciona para transferencias.',
          parameters: {
            type: 'object',
            properties: {
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'requestConfirmation',
          description: 'Solicita confirmación explícita del usuario antes de ejecutar una acción grande (monto mayor a S/1000 o 300 USD). El agente debe responder preguntando si está seguro.',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Descripción de la acción a confirmar (ej. "registrar un gasto de S/ 5000")' },
              amount: { type: 'number', description: 'Monto involucrado en la acción' },
              currency: { type: 'string', description: 'Moneda del monto' }
            },
            required: ['action', 'amount']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getExpenseComparison',
          description: 'Compara gastos entre dos períodos (mes actual vs anterior, semana vs semana, etc). Úsalo para responder "¿gasté más o menos que el mes pasado?".',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['week', 'month', 'bimester', 'year'], description: 'Período a comparar' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['period']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getSpendingPatterns',
          description: 'Analiza patrones de gasto: fines de semana vs entre semana, categorías más recurrentes, detección de anomalías y tendencias.',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'createRefund',
          description: 'Registra una devolución o reembolso (dinero que regresa). Es un ingreso especial con descripción de "reembolso".',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Monto del reembolso (positivo)' },
              currency: { type: 'string', description: 'Moneda (PEN, USD)' },
              description: { type: 'string', description: 'Descripción del reembolso (ej. "Devolución tienda X")' },
              paymentMethodName: { type: 'string', description: 'Método de pago donde llegó el reembolso' },
              originalExpenseId: { type: 'string', description: 'ID del gasto original (para vincular)' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['amount', 'description']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteLastNExpenses',
          description: 'Elimina los últimos N gastos registrados. Útil para "borra los últimos 3 gastos".',
          parameters: {
            type: 'object',
            properties: {
              count: { type: 'number', description: 'Cantidad de gastos a eliminar (ej. 3 para "borra mis últimos 3 gastos")' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['count']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteLastNIncomes',
          description: 'Elimina los últimos N ingresos registrados.',
          parameters: {
            type: 'object',
            properties: {
              count: { type: 'number', description: 'Cantidad de ingresos a eliminar' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            },
            required: ['count']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getAnnualSummary',
          description: 'Obtiene un resumen anual de gastos e ingresos por categoría para consultas fiscales o contables.',
          parameters: {
            type: 'object',
            properties: {
              year: { type: 'number', description: 'Año (ej. 2024). Si no se indica, usa el año pasado.' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getRecurringExpenses',
          description: 'Detecta gastos recurrentes (suscripciones, pagos fijos) y los lista. Útil para saber cuánto pagas al mes en memberships.',
          parameters: {
            type: 'object',
            properties: {
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getWeekendVsWeekdayAnalysis',
          description: 'Analiza cuánto gastas en fines de semana vs días entre semana.',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mes (1-12)' },
              year: { type: 'number', description: 'Año' },
              profileName: { type: 'string', description: 'Nombre del perfil (opcional)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'checkIntegrationStatus',
          description: 'Verifica el estado de las integraciones de email (Gmail/Outlook) y sincronización.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reconnectIntegration',
          description: 'Proporciona instrucciones para reconectar una integración de email desconectada.',
          parameters: {
            type: 'object',
            properties: {
              provider: { type: 'string', enum: ['GMAIL', 'OUTLOOK'], description: 'Proveedor a reconectar' }
            },
            required: ['provider']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getExchangeRate',
          description: 'Obtiene el tipo de cambio actual o convierte un monto entre monedas.',
          parameters: {
            type: 'object',
            properties: {
              fromCurrency: { type: 'string', description: 'Moneda origen (ej. "USD")' },
              toCurrency: { type: 'string', description: 'Moneda destino (ej. "PEN")' },
              amount: { type: 'number', description: 'Monto a convertir (opcional)' }
            }
          }
        }
      }
    ];

    // If there's an image in THIS turn, append it to the user's message content so it gets saved in history
    let messageContent = text;
    if (context?.imageUrl) {
        messageContent += `\n\n[System: Contexto de imagen adjunta: ${context.imageUrl}]`;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: messageContent }
    ];

    const completion = await this.openai.chat.completions.create({
      model: config.openaiModel, // Or gpt-4-turbo, ensuring capability
      messages,
      tools,
      tool_choice: 'auto'
    });

    const choice = completion.choices[0];
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add the assistant's message with tool calls to history ONCE
      messages.push(message);

      // Execute tools
      const toolOutputs: any[] = [];
      let mediaBuffer: Buffer | undefined;
      const toolNames: string[] = [];
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        toolNames.push(fnName);
        const args = JSON.parse(toolCall.function.arguments);
        let output;

        try {
          if (fnName === 'createExpense') {
            // RECOVERY LOGIC: If imageUrl is missing, try to find it in history
            if (!args.imageUrl) {
                // 1. Check current context (single turn)
                if (context?.imageUrl) {
                    args.imageUrl = context.imageUrl;
                } else {
                    // 2. Check history (multi turn)
                    // Iterate backwards to find the last image context
                    for (let i = messages.length - 1; i >= 0; i--) {
                        const m = messages[i];
                        if (m.role === 'user' && typeof m.content === 'string') {
                             const match = m.content.match(/\[System: Contexto de imagen adjunta: (https:\/\/[^\]]+)\]/);
                             if (match && match[1]) {
                                 args.imageUrl = match[1];
                                 break;
                             }
                        }
                    }
                }
            }

            output = await this.createExpense(user, args);
          } else if (fnName === 'updateExpense') {
            // Same recovery logic for updateExpense
             if (!args.imageUrl) {
                if (context?.imageUrl) {
                    args.imageUrl = context.imageUrl;
                } else {
                    for (let i = messages.length - 1; i >= 0; i--) {
                        const m = messages[i];
                        if (m.role === 'user' && typeof m.content === 'string') {
                             const match = m.content.match(/\[System: Contexto de imagen adjunta: (https:\/\/[^\]]+)\]/);
                             if (match && match[1]) {
                                 args.imageUrl = match[1];
                                 break;
                             }
                        }
                    }
                }
            }
            output = await this.updateExpense(user, args);
          } else if (fnName === 'deleteExpense') {
            output = await this.deleteExpense(user, args);
          } else if (fnName === 'createIncome') {
            output = await this.createIncome(user, args);
          } else if (fnName === 'createTransfer') {
            output = await this.createTransfer(user, args);
          } else if (fnName === 'getRecentIncomes') {
            output = await this.getRecentIncomes(user, args);
          } else if (fnName === 'createCategory') {
            output = await this.createCategory(user, args);
          } else if (fnName === 'deleteCategory') {
            output = await this.deleteCategory(user, args);
          } else if (fnName === 'createPaymentMethod') {
            output = await this.createPaymentMethod(user, args);
          } else if (fnName === 'deletePaymentMethod') {
            output = await this.deletePaymentMethod(user, args);
          } else if (fnName === 'getBudget') {
            output = await this.getBudget(user, args);
          } else if (fnName === 'getRecentExpenses') {
            output = await this.getRecentExpenses(user, args);
          } else if (fnName === 'getPendingExpenses') {
            output = await this.getPendingExpenses(user);
          } else if (fnName === 'updateBudget') {
            output = await this.updateBudget(user, args);
          } else if (fnName === 'adjustBudgetFunds') {
            output = await this.adjustBudgetFunds(user, args);
          } else if (fnName === 'getBudgetHistory') {
            output = await this.getBudgetHistory(user, args);
          } else if (fnName === 'manageCategoryBudget') {
            output = await this.manageCategoryBudget(user, args);
          } else if (fnName === 'setDefaultPaymentMethod') {
            output = await this.setDefaultPaymentMethod(user, args);
          } else if (fnName === 'managePaymentMethodBudget') {
            output = await this.managePaymentMethodBudget(user, args);
          } else if (fnName === 'getSubscriptionStatus') {
            output = await this.getSubscriptionStatus(user);
          } else if (fnName === 'getFinancialReport') {
            output = await this.getFinancialReport(user, args);
          } else if (fnName === 'getSavingsStatus') {
            output = await this.getSavingsStatus(user, args);
          } else if (fnName === 'createSavingsGoal') {
            output = await this.createSavingsGoal(user, args);
          } else if (fnName === 'addSavingsTransaction') {
            output = await this.addSavingsTransaction(user, args);
          } else if (fnName === 'deleteSavingsGoal') {
            output = await this.deleteSavingsGoal(user, args);
          } else if (fnName === 'checkMonthlySurplus') {
            output = await this.checkMonthlySurplus(user, args);
          } else if (fnName === 'getUnlinkInstructions') {
            output = await this.getUnlinkInstructions(user);
          } else if (fnName === 'getPaymentMethods') {
            output = await this.getPaymentMethods(user, args);
          } else if (fnName === 'updateUserConfig') {
            output = await this.updateUserConfig(user, args);
          } else if (fnName === 'updateAntExpenseConfig') {
            output = await this.updateAntExpenseConfig(user, args);
          } else if (fnName === 'updateUserProfile') {
            output = await this.updateUserProfile(user.id, args);
          } else if (fnName === 'sendFinancialReport') {
            const reportResult = await this.sendFinancialReport(user, args);
            if (reportResult.success && reportResult.buffer) {
               mediaBuffer = reportResult.buffer;
               output = { success: true, message: reportResult.message };
            } else {
               output = reportResult;
            }
          } else if (fnName === 'updateNotificationPreferences') {
            output = await this.updateNotificationPreferences(user, args);
          } else if (fnName === 'approvePendingExpense') {
            output = await this.approvePendingExpense(user, args);
          } else if (fnName === 'rejectPendingExpense') {
            output = await this.rejectPendingExpense(user, args);
          } else if (fnName === 'updateIncome') {
            output = await this.updateIncome(user, args);
          } else if (fnName === 'deleteIncome') {
            output = await this.deleteIncome(user, args);
          } else if (fnName === 'undoLastTransaction') {
            output = await this.undoLastTransaction(user, args);
          } else if (fnName === 'requestConfirmation') {
            output = { needsConfirmation: true, action: args.action, amount: args.amount, currency: args.currency };
          } else if (fnName === 'getExpenseComparison') {
            output = await this.getExpenseComparison(user, args);
          } else if (fnName === 'getSpendingPatterns') {
            output = await this.getSpendingPatterns(user, args);
          } else if (fnName === 'createRefund') {
            output = await this.createRefund(user, args);
          } else if (fnName === 'deleteLastNExpenses') {
            output = await this.deleteLastNExpenses(user, args);
          } else if (fnName === 'deleteLastNIncomes') {
            output = await this.deleteLastNIncomes(user, args);
          } else if (fnName === 'getAnnualSummary') {
            output = await this.getAnnualSummary(user, args);
          } else if (fnName === 'getRecurringExpenses') {
            output = await this.getRecurringExpenses(user, args);
          } else if (fnName === 'getWeekendVsWeekdayAnalysis') {
            output = await this.getWeekendVsWeekdayAnalysis(user, args);
          } else if (fnName === 'checkIntegrationStatus') {
            output = await this.checkIntegrationStatus(user);
          } else if (fnName === 'reconnectIntegration') {
            output = await this.reconnectIntegration(user, args);
          } else if (fnName === 'getExchangeRate') {
            output = await this.getExchangeRate(user, args);
          } else {
            output = { error: 'Función desconocida' };
          }
        } catch (e: any) {
          output = { error: e.message };
        }
        
        // Add result to conversation for final response
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(output)
        });
      }

      // Get final response from model
      const finalCompletion = await this.openai.chat.completions.create({
        model: config.openaiModel,
        messages,
      });
      
      const finalMessage = finalCompletion.choices[0].message;
      messages.push(finalMessage);
      await this.saveHistory(userId, messages.slice(1), activeProfileId);

    // 4. Update Context with RESULT
    // We do this BEFORE returning to ensure context is fresh for next turn
    let actionSummary = `Se ejecutaron herramientas: ${toolNames.join(', ')}.`;
    let createdExpenseId: string | undefined = undefined;

    if (toolNames.includes('createExpense')) {
        const output = toolOutputs.find(o => o.success && o.data && (o.data.expense || o.data.transaction));
        if (output) {
            const exp = output.data.expense || output.data.transaction;
            actionSummary = `GASTO REGISTRADO: ${exp.currency} ${exp.amount} en ${exp.category?.name || 'Sin Categoría'} (${exp.description || 'Sin descripción'}). ID: ${exp.id}`;
            createdExpenseId = exp.id;
        }
    }
    
    await this.updateAgentContext(userId, { 
        status: 'COMPLETED', 
        lastAction: actionSummary, 
        timestamp: new Date().toISOString() 
    });

    // Guardar en memoria a largo plazo (RAG)
    this.saveMemory(userId, text, 'user').catch(console.error);
    if (finalMessage.content) {
        this.saveMemory(userId, finalMessage.content, 'assistant').catch(console.error);
    }

    const res = this.formatResponse(finalMessage.content || 'Operación realizada.', createdExpenseId);
    if (mediaBuffer && typeof res === 'object') {
        (res as any).mediaBuffer = mediaBuffer;
    } else if (mediaBuffer && typeof res === 'string') {
        return { text: res, mediaBuffer };
    }
    return res as (string | { text: string; buttons?: any[]; mediaBuffer?: Buffer });
    }

    messages.push(message);
    await this.saveHistory(userId, messages.slice(1), activeProfileId);

    await this.updateAgentContext(userId, { lastUser: text, lastAgent: message.content });

    // Guardar en memoria a largo plazo (RAG)
    this.saveMemory(userId, text, 'user').catch(console.error);
    if (message.content) {
        this.saveMemory(userId, message.content, 'assistant').catch(console.error);
    }

    return this.formatResponse(message.content || 'No entendí tu solicitud.');
  }

  private formatResponse(text: string, expenseId?: string): string | { text: string; buttons: any[]; mediaBuffer?: Buffer } {
    let dashboardLink = 'https://contapro.lat/dashboard';
    if (expenseId) {
        dashboardLink = `https://contapro.lat/dashboard?modal=edit_expense&id=${expenseId}`;
    }

    // Regex matches:
    // 1. "🔗 Ver en el dashboard: ..." (literal)
    // 2. Markdown links [text](url) containing the dashboard link
    // 3. Raw URLs
    // 4. "Ver en el dashboard:" prefix alone
    if (text.includes('contapro.lat') || text.includes('Ver en el dashboard') || text.includes('dashboard')) {
        let cleanText = text
            .replace(/🔗? ?Ver en (el )?dashboard:? ?(\[.*?\]\(.*?\)|https?:\/\/[^\s]+)?/gi, '') // Remove "Ver en dashboard: [link](url)" or "Ver en dashboard: url"
            .replace(/\[.*?\]\(https:\/\/contapro\.lat\/.*?\)/g, '') // Remove markdown links with specific url
            .replace(/https:\/\/contapro\.lat\/[^\s]*/g, '') // Remove raw url
            .trim();
        
        // Clean up trailing dashes or decorative lines if left behind
        cleanText = cleanText.replace(/\n\s*$/, '');

        return {
            text: cleanText,
            buttons: [{
                type: 'url',
                display: expenseId ? 'Ver / Editar Gasto' : 'Ver Dashboard', // Shortened to ensure it fits
                url: dashboardLink
            }]
        };
    }
    
    // Si no mencionó dashboard pero creamos un gasto, agregamos el botón de todas formas opcionalmente
    if (expenseId) {
        return {
            text: text.trim(),
            buttons: [{
                type: 'url',
                display: 'Ver / Editar Gasto',
                url: dashboardLink
            }]
        };
    }

    return text;
  }

  // --- Tool Implementations ---

  private resolveProfileId(user: any, profileName?: string): string {
    if (!profileName) return user.activeProfileId;
    
    const normalized = profileName.toLowerCase().trim();
    
    // 1. Exact match
    const match = user.profiles.find((p: any) => p.name.toLowerCase() === normalized);
    if (match) return match.id;
    
    // 2. Partial match
    const partial = user.profiles.find((p: any) => p.name.toLowerCase().includes(normalized));
    if (partial) return partial.id;
    
    return user.activeProfileId;
  }



  private async createExpense(user: any, args: any) {
    const { amount, currency, description, categoryName, paymentMethodName, date, type, imageUrl, emitter, provider, ruc, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    let categoryId = null;
    if (categoryName) {
        // Try to find category
        const cat = await this.app.prisma.category.findFirst({
            where: { userId: user.id, profileId, name: { equals: categoryName, mode: 'insensitive' } }
        });
        if (cat) categoryId = cat.id;
        else {
            // Create if specific enough or requested
            const newCat = await this.app.prisma.category.create({
                data: { name: categoryName, userId: user.id, profileId }
            });
            categoryId = newCat.id;
        }
    }

    let paymentMethodId = null;
    if (paymentMethodName) {
         // 1. Direct/Contains match
         let pm = await this.app.prisma.paymentMethod.findFirst({
            where: { 
                userId: user.id, 
                profileId,
                active: true,
                OR: [
                    { name: { equals: paymentMethodName, mode: 'insensitive' } },
                    { name: { contains: paymentMethodName, mode: 'insensitive' } },
                    { provider: { contains: paymentMethodName, mode: 'insensitive' } }
                ]
            }
        });

        // 2. Word match fallback (e.g. "tarjeta amex" -> matches "Amex")
        if (!pm) {
            const stopWords = ['tarjeta', 'metodo', 'pago', 'banco', 'bank', 'card', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'mi', 'mis', 'con', 'credito', 'debito', 'credit', 'debit'];
            const words = paymentMethodName.split(' ').filter((w: string) => w.length > 2 && !stopWords.includes(w.toLowerCase()));
            for (const word of words) {
                pm = await this.app.prisma.paymentMethod.findFirst({
                    where: { 
                        userId: user.id, 
                        profileId,
                        active: true,
                        OR: [
                            { name: { contains: word, mode: 'insensitive' } },
                            { provider: { contains: word, mode: 'insensitive' } }
                        ]
                    }
                });
                if (pm) break;
            }
        }

        if (pm) {
            paymentMethodId = pm.id;
        } else {
            // Auto-create Payment Method if it doesn't exist (Create Flow)
            // This prevents falling back to default payment method when user explicitly asked for something else
            const newPm = await this.app.prisma.paymentMethod.create({
                data: {
                    userId: user.id,
                    profileId,
                    name: paymentMethodName,
                    provider: paymentMethodName, // Fallback provider name
                    type: 'OTHER',
                    currency: currency || user.preferredCurrency
                }
            });
            paymentMethodId = newPm.id;
        }
    } else if (user.defaultPaymentMethodId) {
        // Only use default if NO name was specified
        // Validate that the default payment method belongs to the current profile (or is global)
        const defaultPm = await this.app.prisma.paymentMethod.findFirst({
            where: {
                id: user.defaultPaymentMethodId,
                active: true,
                OR: [{ profileId }, { profileId: null }]
            }
        });

        if (defaultPm) {
            paymentMethodId = defaultPm.id;
        } else {
            // If default is invalid for this profile, we fall back to null (Efectivo)
            // Ideally we could warn, but for now just don't use the wrong profile's method
            paymentMethodId = null; 
        }
    }

    // Extract documentId from imageUrl if present
    let documentId = undefined;
    let source = 'MANUAL';

    if (imageUrl) {
        // Try to match standard UUID pattern in the proxy URL
        const match = imageUrl.match(/documents\/([a-f0-9-]{36})\/preview/);
        if (match && match[1]) {
            documentId = match[1];
            source = 'DOCUMENT';
            console.log(`[createExpense] Linking expense to Document ID: ${documentId}`);
        } else {
             console.log(`[createExpense] Failed to extract Document ID from imageUrl: ${imageUrl}`);
        }
    }

    const expenseCurrency = currency || user.preferredCurrency;
    const targetCurrency = user.preferredCurrency;
    let finalAmount = Number(amount);
    if (isNaN(finalAmount)) finalAmount = 0;

    const { amount: amountNative, rate: exchangeRate } = await this.currencyService.convert(finalAmount, expenseCurrency, targetCurrency);

    let finalDate = new Date();
    if (date && date.toLowerCase() !== 'hoy' && date.toLowerCase() !== 'today') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            finalDate = parsedDate;
        }
    }

    const validTypes = ['FACTURA', 'BOLETA', 'YAPE', 'PLIN', 'TUNKI', 'LEMONPAY', 'BCP', 'INTERBANK', 'SCOTIABANK', 'BBVA', 'INFORMAL'];
    let finalType = type && validTypes.includes(String(type).toUpperCase()) ? String(type).toUpperCase() : 'INFORMAL';

    const expense = await this.app.prisma.expense.create({
      data: {
        userId: user.id,
        profileId,
        amount: finalAmount,
        currency: expenseCurrency,
        amountNative,
        exchangeRate,
        description: description || (emitter ? `Gasto en ${emitter}` : 'Gasto vario'),
        provider: emitter || 'Varios',
        issuedAt: finalDate,
        type: finalType as any,
        source: source as any, 
        categoryId,
        paymentMethodId,
        documentId,
        emitterIdNumber: ruc
      }
    });

    // Check budget alerts
    const alertAmount = expense.amountNative ?? expense.amount;
    await checkBudgetAlertAfterExpense(this.app, expense.userId, profileId, new Date(expense.issuedAt), alertAmount, expense.categoryId ?? undefined);
    
    // Check for "Gastos Hormiga"
    const antWarning = await checkAntExpenses(this.app, user, profileId);
    let message = `Gasto de ${expense.currency} ${expense.amount} registrado.`;
    if (antWarning) {
        message += `\n\n⚠️ ${antWarning}`;
    }

    // Return the actual payment method used to inform the agent
    let usedPaymentMethodName = 'Efectivo'; // Default fallback
    if (paymentMethodId) {
        const pm = await this.app.prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
        if (pm) usedPaymentMethodName = pm.name;
    }

    return { 
        success: true, 
        expenseId: expense.id, 
        message, 
        paymentMethodName: usedPaymentMethodName 
    };
  }

  private async updateExpense(user: any, args: any) {
    const { expenseId, amount, currency, description, categoryName, paymentMethodName, date, emitter, provider, imageUrl, ruc, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    let expenseToUpdate;

    if (expenseId) {
        expenseToUpdate = await this.app.prisma.expense.findUnique({
            where: { id: expenseId }
        });
    } else {
        // Find last created expense by this user (within reason, say last 24h?)
        // Just finding the absolute last one is usually what's expected in chat context.
        expenseToUpdate = await this.app.prisma.expense.findFirst({
            where: { userId: user.id, profileId },
            orderBy: { createdAt: 'desc' }
        });
    }

    if (!expenseToUpdate || expenseToUpdate.userId !== user.id) {
        return { success: false, message: 'No se encontró el gasto para modificar.' };
    }

    // Check profile ownership
    if (profileId && expenseToUpdate.profileId && expenseToUpdate.profileId !== profileId) {
        return { success: false, message: 'El gasto pertenece a otro perfil.' };
    }

    const data: any = {};
    if (amount !== undefined) {
        const finalAmount = Number(amount);
        if (!isNaN(finalAmount)) data.amount = finalAmount;
    }
    if (currency) data.currency = currency;
    if (description) data.description = description;
    if (date && date.toLowerCase() !== 'hoy' && date.toLowerCase() !== 'today') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            data.issuedAt = parsedDate;
        }
    }
    
    // Support both 'emitter' and 'provider' args
    const newProvider = provider || emitter;
    if (newProvider) {
        data.provider = newProvider;
    }

    if (ruc) {
        data.emitterIdNumber = ruc;
    }

    // Update document if imageUrl provided
    if (imageUrl) {
        const match = imageUrl.match(/documents\/([a-f0-9-]{36})\/preview/);
        if (match && match[1]) {
            data.documentId = match[1];
        }
    }

    if (categoryName) {
        const cat = await this.app.prisma.category.findFirst({
            where: { userId: user.id, profileId, name: { equals: categoryName, mode: 'insensitive' } }
        });
        if (cat) data.categoryId = cat.id;
        else {
             const newCat = await this.app.prisma.category.create({
                data: { name: categoryName, userId: user.id, profileId }
            });
            data.categoryId = newCat.id;
        }
    }

    if (paymentMethodName) {
        // 1. Direct/Contains match
        let pm = await this.app.prisma.paymentMethod.findFirst({
            where: { 
                userId: user.id, 
                profileId,
                active: true,
                OR: [
                    { name: { equals: paymentMethodName, mode: 'insensitive' } },
                    { name: { contains: paymentMethodName, mode: 'insensitive' } },
                    { provider: { contains: paymentMethodName, mode: 'insensitive' } }
                ]
            }
        });

        // 2. Word match fallback
        if (!pm) {
            const stopWords = ['tarjeta', 'metodo', 'pago', 'banco', 'bank', 'card', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'mi', 'mis', 'con', 'credito', 'debito', 'credit', 'debit'];
            const words = paymentMethodName.split(' ').filter((w: string) => w.length > 2 && !stopWords.includes(w.toLowerCase()));
            for (const word of words) {
                pm = await this.app.prisma.paymentMethod.findFirst({
                    where: { 
                        userId: user.id, 
                        profileId,
                        active: true,
                        OR: [
                            { name: { contains: word, mode: 'insensitive' } },
                            { provider: { contains: word, mode: 'insensitive' } }
                        ]
                    }
                });
                if (pm) break;
            }
        }

        if (pm) {
            data.paymentMethodId = pm.id;
        } else {
            // Auto-create Payment Method if it doesn't exist (Update Flow)
            const newPm = await this.app.prisma.paymentMethod.create({
                data: {
                    userId: user.id,
                    profileId,
                    name: paymentMethodName,
                    provider: paymentMethodName, // Fallback
                    type: 'OTHER', // Fallback
                    currency: currency || user.preferredCurrency
                }
            });
            data.paymentMethodId = newPm.id;
        }
    }

    if (data.amount !== undefined || currency) {
        const newAmount = data.amount !== undefined ? data.amount : expenseToUpdate.amount;
        const newCurrency = currency || expenseToUpdate.currency;
        const targetCurrency = user.preferredCurrency;
        
        const { amount: amountNative, rate: exchangeRate } = await this.currencyService.convert(newAmount, newCurrency, targetCurrency);
        data.amountNative = amountNative;
        data.exchangeRate = exchangeRate;
    }

    const updated = await this.app.prisma.expense.update({
        where: { id: expenseToUpdate.id },
        data,
        include: { category: true }
    });

    // Check budget alerts again if amount changed
    if (amount !== undefined || date !== undefined || currency !== undefined) {
        const alertAmount = updated.amountNative ?? updated.amount;
        await checkBudgetAlertAfterExpense(this.app, updated.userId, profileId, new Date(updated.issuedAt), alertAmount, updated.categoryId ?? undefined);
    }

    const catMsg = updated.category ? ` (Categoría: ${updated.category.name})` : '';
    return { success: true, expenseId: updated.id, message: `Gasto actualizado.${catMsg}` };
  }

  private async deleteExpense(user: any, args: any) {
    const { expenseId, profileName, count } = args;
    const profileId = this.resolveProfileId(user, profileName);

    // BATCH DELETION
    if (count && count > 0) {
        const expensesToDelete = await this.app.prisma.expense.findMany({
            where: { userId: user.id, profileId },
            orderBy: { createdAt: 'desc' },
            take: count
        });

        if (expensesToDelete.length === 0) {
            return { success: false, message: 'No encontré gastos recientes para eliminar.' };
        }

        let deletedCount = 0;
        // Process one by one to handle document cleanup safely
        for (const expense of expensesToDelete) {
            // Check ownership again just in case
            if (expense.userId !== user.id) continue;
            if (profileId && expense.profileId && expense.profileId !== profileId) continue;

            const docId = expense.documentId;
            try {
                await this.app.prisma.expense.delete({ where: { id: expense.id } });
                
                if (docId) {
                    try {
                        await this.app.prisma.analysis.delete({ where: { documentId: docId } });
                    } catch {}
                    try {
                        await this.app.prisma.document.delete({ where: { id: docId } });
                    } catch {}
                }
                deletedCount++;
            } catch (e) {
                console.error(`Error deleting expense ${expense.id}:`, e);
            }
        }

        return { success: true, message: `Se han eliminado los últimos ${deletedCount} gastos correctamente.` };
    }

    // SINGLE DELETION (Legacy Logic)
    let expenseToDelete;

    if (expenseId) {
        expenseToDelete = await this.app.prisma.expense.findUnique({ where: { id: expenseId } });
    } else {
        expenseToDelete = await this.app.prisma.expense.findFirst({
            where: { userId: user.id, profileId },
            orderBy: { createdAt: 'desc' }
        });
    }

    if (!expenseToDelete || expenseToDelete.userId !== user.id) {
        return { success: false, message: 'No se encontró el gasto a eliminar.' };
    }
    
    if (profileId && expenseToDelete.profileId && expenseToDelete.profileId !== profileId) {
        return { success: false, message: 'El gasto pertenece a otro perfil.' };
    }

    const docId = expenseToDelete.documentId;
    await this.app.prisma.expense.delete({ where: { id: expenseToDelete.id } });

    if (docId) {
        try {
            await this.app.prisma.analysis.delete({ where: { documentId: docId } });
        } catch {}
        try {
            await this.app.prisma.document.delete({ where: { id: docId } });
        } catch {}
    }

    return { success: true, message: `Gasto eliminado.` };
  }

  private async createIncome(user: any, args: any) {
    const { amount, currency, description, paymentMethodName, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    let paymentMethodId = null;
    let pm = null;
    if (paymentMethodName) {
        pm = await this.app.prisma.paymentMethod.findFirst({
            where: { 
                userId: user.id, 
                profileId,
                active: true,
                OR: [
                    { name: { equals: paymentMethodName, mode: 'insensitive' } },
                    { name: { contains: paymentMethodName, mode: 'insensitive' } },
                    { provider: { contains: paymentMethodName, mode: 'insensitive' } }
                ]
            }
        });
        if (pm) paymentMethodId = pm.id;
    } else if (user.defaultPaymentMethodId) {
        pm = await this.app.prisma.paymentMethod.findFirst({
            where: { id: user.defaultPaymentMethodId, active: true, OR: [{ profileId }, { profileId: null }] }
        });
        if (pm) paymentMethodId = pm.id;
    }

    if (!paymentMethodId || !pm) {
        return { success: false, message: `No encontré el método de pago "${paymentMethodName || 'default'}". Por favor verifica.` };
    }

    const incomeCurrency = currency || pm.currency || user.preferredCurrency || 'PEN';
    const targetCurrency = user.preferredCurrency || 'PEN';
    
    let finalAmount = Number(amount);
    if (isNaN(finalAmount)) finalAmount = 0;

    const { amount: amountNative, rate: exchangeRate } = await this.currencyService.convert(finalAmount, incomeCurrency, targetCurrency);

    const income = await this.app.prisma.$transaction(async (tx: any) => {
        const inc = await tx.income.create({
            data: {
                userId: user.id,
                profileId,
                paymentMethodId,
                amount: finalAmount,
                currency: incomeCurrency,
                amountNative,
                exchangeRate,
                description: description || 'Ingreso registrado vía chat',
                issuedAt: new Date()
            }
        });

        let amountToAdd = amount;
        if (incomeCurrency !== pm.currency) {
            const converted = await this.currencyService.convert(amount, incomeCurrency, pm.currency);
            amountToAdd = converted.amount;
        }

        await tx.paymentMethod.update({
            where: { id: pm.id },
            data: { balance: { increment: amountToAdd } }
        });

        return inc;
    });

    return { success: true, message: `Ingreso de ${incomeCurrency} ${amount} registrado en ${pm.name}. Nuevo balance aproximado sumado.` };
  }

  private async createTransfer(user: any, args: any) {
    const { amount, currency, originPaymentMethodName, destinationPaymentMethodName, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    const findPM = async (name: string) => {
        return await this.app.prisma.paymentMethod.findFirst({
            where: { 
                userId: user.id, 
                profileId,
                active: true,
                OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    { name: { contains: name, mode: 'insensitive' } },
                    { provider: { contains: name, mode: 'insensitive' } }
                ]
            }
        });
    };

    const originPm = await findPM(originPaymentMethodName);
    const destPm = await findPM(destinationPaymentMethodName);

    if (!originPm) return { success: false, message: `No encontré la cuenta de origen: ${originPaymentMethodName}` };
    if (!destPm) return { success: false, message: `No encontré la cuenta de destino: ${destinationPaymentMethodName}` };

    const transferCurrency = currency || user.preferredCurrency || 'PEN';
    const targetCurrency = user.preferredCurrency || 'PEN';
    const { amount: amountNative, rate: exchangeRate } = await this.currencyService.convert(amount, transferCurrency, targetCurrency);

    await this.app.prisma.$transaction(async (tx: any) => {
        // Gasto en origen
        await tx.expense.create({
            data: {
                userId: user.id,
                profileId,
                amount,
                currency: transferCurrency,
                amountNative,
                exchangeRate,
                description: `Transferencia hacia ${destPm.name}`,
                provider: destPm.name,
                issuedAt: new Date(),
                type: 'INFORMAL',
                source: 'MANUAL',
                paymentMethodId: originPm.id
            }
        });

        // Ingreso en destino
        await tx.income.create({
            data: {
                userId: user.id,
                profileId,
                paymentMethodId: destPm.id,
                amount,
                currency: transferCurrency,
                amountNative,
                exchangeRate,
                description: `Transferencia desde ${originPm.name}`,
                issuedAt: new Date()
            }
        });

        // Actualizar balances
        let amountToSub = amount;
        if (transferCurrency !== originPm.currency) {
            const converted = await this.currencyService.convert(amount, transferCurrency, originPm.currency);
            amountToSub = converted.amount;
        }
        await tx.paymentMethod.update({
            where: { id: originPm.id },
            data: { balance: { decrement: amountToSub } }
        });

        let amountToAdd = amount;
        if (transferCurrency !== destPm.currency) {
            const converted = await this.currencyService.convert(amount, transferCurrency, destPm.currency);
            amountToAdd = converted.amount;
        }
        await tx.paymentMethod.update({
            where: { id: destPm.id },
            data: { balance: { increment: amountToAdd } }
        });
    });

    return { success: true, message: `Transferencia de ${transferCurrency} ${amount} desde ${originPm.name} hacia ${destPm.name} completada.` };
  }

  private async getRecentIncomes(user: any, args: any) {
    const limit = args.limit || 20;
    const profileId = this.resolveProfileId(user, args.profileName);
    const where: any = { userId: user.id, profileId };
    
    if (args.month) {
        const y = args.year || new Date().getFullYear();
        const start = new Date(y, args.month - 1, 1);
        const end = new Date(y, args.month, 0, 23, 59, 59, 999);
        where.issuedAt = { gte: start, lte: end };
    } else {
        // Por defecto mes actual
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        where.issuedAt = { gte: start };
    }

    const incomes = await this.app.prisma.income.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        take: limit,
        include: { paymentMethod: true }
    });

    if (incomes.length === 0) {
        return { message: 'No se encontraron ingresos en el periodo solicitado.' };
    }

    const list = incomes.map(i => {
        const dateObj = new Date(i.issuedAt);
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        return {
            id: i.id,
            fecha: `${day}/${month}`,
            monto: i.amount,
            moneda: i.currency,
            descripcion: i.description,
            metodo: i.paymentMethod?.name || 'Desconocido'
        };
    });

    return { 
        count: incomes.length, 
        incomes: list,
        message: 'Lista de ingresos recuperada. Formatea esta lista según las instrucciones de estilo.' 
    };
  }

  private async createCategory(user: any, args: any) {
    const { name, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const exists = await this.app.prisma.category.findFirst({
        where: { userId: user.id, profileId, name: { equals: name, mode: 'insensitive' } }
    });
    if (exists) return { success: false, message: 'La categoría ya existe.' };

    const cat = await this.app.prisma.category.create({
        data: { name, userId: user.id, profileId }
    });
    return { success: true, category: cat.name, message: `Categoría "${cat.name}" creada.` };
  }

  private async deleteCategory(user: any, args: any) {
    const { name, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const cat = await this.app.prisma.category.findFirst({
        where: { userId: user.id, profileId, name: { equals: name, mode: 'insensitive' } }
    });
    if (!cat) return { success: false, message: 'La categoría no existe.' };

    try {
        await this.app.prisma.category.delete({ where: { id: cat.id } });
        return { success: true, message: `Categoría "${cat.name}" eliminada.` };
    } catch (e) {
        return { success: false, message: 'No se pudo eliminar. Puede que tenga gastos asociados.' };
    }
  }

  private async approvePendingExpense(user: any, args: any) {
    const { pendingExpenseId, categoryName, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    const pending = await this.app.prisma.pendingExpense.findUnique({
        where: { id: pendingExpenseId },
        include: { user: true }
    });

    if (!pending) return { success: false, message: 'Gasto pendiente no encontrado.' };
    if (pending.userId !== user.id) return { success: false, message: 'No tienes permiso sobre este gasto.' };
    if (pending.status !== 'WAITING_USER') return { success: false, message: `Este gasto ya fue ${pending.status === 'APPROVED' ? 'aprobado' : 'rechazado'}.` };

    let categoryId = null;
    if (categoryName) {
        const cat = await this.app.prisma.category.findFirst({
            where: { userId: user.id, profileId, name: { equals: categoryName, mode: 'insensitive' } }
        });
        if (cat) categoryId = cat.id;
    }

    await this.app.prisma.$transaction(async (tx) => {
        await tx.expense.create({
            data: {
                userId: user.id,
                profileId,
                amount: pending.amount,
                currency: pending.currency,
                description: pending.description || pending.merchant || 'Gasto aprobado',
                provider: pending.merchant || 'Unknown',
                type: 'INFORMAL',
                source: 'DOCUMENT',
                issuedAt: pending.date,
                categoryId: categoryId
            }
        });

        await tx.pendingExpense.update({
            where: { id: pendingExpenseId },
            data: { status: 'APPROVED' }
        });
    });

    return { success: true, message: `Gasto de ${pending.currency} ${pending.amount} aprobado y registrado.` };
  }

  private async rejectPendingExpense(user: any, args: any) {
    const { pendingExpenseId, reason } = args;

    const pending = await this.app.prisma.pendingExpense.findUnique({
        where: { id: pendingExpenseId }
    });

    if (!pending) return { success: false, message: 'Gasto pendiente no encontrado.' };
    if (pending.userId !== user.id) return { success: false, message: 'No tienes permiso sobre este gasto.' };
    if (pending.status !== 'WAITING_USER') return { success: false, message: 'Este gasto ya fue procesado.' };

    await this.app.prisma.pendingExpense.update({
        where: { id: pendingExpenseId },
        data: { status: 'REJECTED' }
    });

    return { success: true, message: 'Gasto pendiente rechazado.' };
  }

  private async updateIncome(user: any, args: any) {
    const { incomeId, amount, currency, description, paymentMethodName, date, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    let targetIncome;
    if (incomeId) {
        targetIncome = await this.app.prisma.income.findFirst({
            where: { id: incomeId, userId: user.id, profileId }
        });
    } else {
        targetIncome = await this.app.prisma.income.findFirst({
            where: { userId: user.id, profileId },
            orderBy: { issuedAt: 'desc' }
        });
    }

    if (!targetIncome) return { success: false, message: 'Ingreso no encontrado.' };

    let paymentMethodId = targetIncome.paymentMethodId;
    if (paymentMethodName) {
        const pm = await this.app.prisma.paymentMethod.findFirst({
            where: { userId: user.id, profileId, active: true, name: { contains: paymentMethodName, mode: 'insensitive' } }
        });
        if (pm) paymentMethodId = pm.id;
    }

    const updateData: any = {};
    if (amount !== undefined) {
        const finalAmount = Number(amount);
        if (!isNaN(finalAmount)) updateData.amount = finalAmount;
    }
    if (currency) updateData.currency = currency;
    if (description) updateData.description = description;
    if (paymentMethodId) updateData.paymentMethodId = paymentMethodId;
    if (date && date.toLowerCase() !== 'hoy' && date.toLowerCase() !== 'today') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            updateData.issuedAt = parsedDate;
        }
    }

    if (updateData.amount !== undefined || updateData.currency) {
        const newAmount = updateData.amount !== undefined ? updateData.amount : targetIncome.amount;
        const newCurrency = updateData.currency || targetIncome.currency;
        const targetCurrency = user.preferredCurrency || 'PEN';
        
        const { amount: amountNative, rate: exchangeRate } = await this.currencyService.convert(newAmount, newCurrency, targetCurrency);
        updateData.amountNative = amountNative;
        updateData.exchangeRate = exchangeRate;
    }

    const updated = await this.app.prisma.income.update({
        where: { id: targetIncome.id },
        data: updateData
    });

    return { success: true, message: `Ingreso actualizado: ${updated.amount} ${updated.currency}.` };
  }

  private async deleteIncome(user: any, args: any) {
    const { incomeId, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    let targetIncome;
    if (incomeId) {
        targetIncome = await this.app.prisma.income.findFirst({
            where: { id: incomeId, userId: user.id, profileId }
        });
    } else {
        targetIncome = await this.app.prisma.income.findFirst({
            where: { userId: user.id, profileId },
            orderBy: { issuedAt: 'desc' }
        });
    }

    if (!targetIncome) return { success: false, message: 'Ingreso no encontrado.' };

    await this.app.prisma.income.delete({ where: { id: targetIncome.id } });

    return { success: true, message: `Ingreso de ${targetIncome.amount} ${targetIncome.currency} eliminado.` };
  }

  private async undoLastTransaction(user: any, args: any) {
    const { profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    const lastExpense = await this.app.prisma.expense.findFirst({
        where: { userId: user.id, profileId },
        orderBy: { createdAt: 'desc' }
    });

    const lastIncome = await this.app.prisma.income.findFirst({
        where: { userId: user.id, profileId },
        orderBy: { issuedAt: 'desc' }
    });

    if (!lastExpense && !lastIncome) {
        return { success: false, message: 'No hay transacciones recientes para deshacer.' };
    }

    const expenseDate = lastExpense ? new Date(lastExpense.createdAt) : null;
    const incomeDate = lastIncome ? new Date(lastIncome.issuedAt) : null;
    const now = new Date();

    if (!expenseDate && !incomeDate) {
        return { success: false, message: 'No hay transacciones recientes para deshacer.' };
    }

    const expenseHours = expenseDate ? (now.getTime() - expenseDate.getTime()) / (1000 * 60 * 60) : Infinity;
    const incomeHours = incomeDate ? (now.getTime() - incomeDate.getTime()) / (1000 * 60 * 60) : Infinity;

    if (expenseHours > 24 && incomeHours > 24) {
        return { success: false, message: 'Solo puedes deshacer transacciones de las últimas 24 horas.' };
    }

    if (expenseDate && expenseHours <= incomeHours) {
        await this.app.prisma.expense.delete({ where: { id: lastExpense!.id } });
        return { success: true, message: `Gasto de ${lastExpense!.amount} ${lastExpense!.currency} eliminado.` };
    } else if (lastIncome) {
        await this.app.prisma.income.delete({ where: { id: lastIncome.id } });
        return { success: true, message: `Ingreso de ${lastIncome.amount} ${lastIncome.currency} eliminado.` };
    }

    return { success: false, message: 'No se pudo deshacer.' };
  }

  private async getExpenseComparison(user: any, args: any) {
    const { period, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const now = new Date();
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';

    let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;

    if (period === 'week') {
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentStart = new Date(now);
        currentStart.setDate(now.getDate() - diffToMonday);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd = new Date(now);
        prevStart = new Date(currentStart);
        prevStart.setDate(prevStart.getDate() - 7);
        prevEnd = new Date(currentStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
    } else if (period === 'month') {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (period === 'bimester') {
        const currentBimester = Math.floor(now.getMonth() / 2);
        const prevBimester = currentBimester === 0 ? 5 : currentBimester - 1;
        const prevYear = currentBimester === 0 ? now.getFullYear() - 1 : now.getFullYear();
        currentStart = new Date(now.getFullYear(), currentBimester * 2, 1);
        currentEnd = new Date(now.getFullYear(), currentBimester * 2 + 2, 0, 23, 59, 59);
        prevStart = new Date(prevYear, prevBimester * 2, 1);
        prevEnd = new Date(prevYear, prevBimester * 2 + 2, 0, 23, 59, 59);
    } else {
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        prevStart = new Date(now.getFullYear() - 1, 0, 1);
        prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    }

    const [currExp, prevExp, currInc, prevInc] = await Promise.all([
        this.app.prisma.expense.findMany({ where: { userId: user.id, profileId, issuedAt: { gte: currentStart, lte: currentEnd } } }),
        this.app.prisma.expense.findMany({ where: { userId: user.id, profileId, issuedAt: { gte: prevStart, lte: prevEnd } } }),
        this.app.prisma.income.findMany({ where: { userId: user.id, profileId, issuedAt: { gte: currentStart, lte: currentEnd } } }),
        this.app.prisma.income.findMany({ where: { userId: user.id, profileId, issuedAt: { gte: prevStart, lte: prevEnd } } })
    ]);

    let currSpent = 0, prevSpent = 0, currIncome = 0, prevIncome = 0;
    for (const e of currExp) currSpent += await getAmountNative(e, targetCurrency, currencyService);
    for (const e of prevExp) prevSpent += await getAmountNative(e, targetCurrency, currencyService);
    for (const i of currInc) currIncome += await getAmountNative(i, targetCurrency, currencyService);
    for (const i of prevInc) prevIncome += await getAmountNative(i, targetCurrency, currencyService);

    const spentDiff = currSpent - prevSpent;
    const incomeDiff = currIncome - prevIncome;
    const pctChange = prevSpent > 0 ? ((spentDiff / prevSpent) * 100).toFixed(1) : 'N/A';

    return {
        period,
        current: { spent: currSpent.toFixed(2), income: currIncome.toFixed(2), count: currExp.length },
        previous: { spent: prevSpent.toFixed(2), income: prevIncome.toFixed(2), count: prevExp.length },
        difference: { spent: spentDiff.toFixed(2), spentPct: pctChange, income: incomeDiff.toFixed(2) },
        message: `Este ${period} gastaste ${targetCurrency} ${currSpent.toFixed(2)} vs ${prevSpent.toFixed(2)} del período anterior (${pctChange}%).`
    };
  }

  private async getSpendingPatterns(user: any, args: any) {
    const { startDate, endDate, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    const expenses = await this.app.prisma.expense.findMany({
        where: { userId: user.id, profileId, issuedAt: { gte: start, lte: end } },
        include: { category: true }
    });

    const incomes = await this.app.prisma.income.findMany({
        where: { userId: user.id, profileId, issuedAt: { gte: start, lte: end } }
    });

    let totalSpent = 0, totalIncome = 0;
    for (const e of expenses) totalSpent += await getAmountNative(e, targetCurrency, currencyService);
    for (const i of incomes) totalIncome += await getAmountNative(i, targetCurrency, currencyService);

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
        const cat = e.category?.name || 'Sin categoría';
        byCategory[cat] = (byCategory[cat] || 0) + (await getAmountNative(e, targetCurrency, currencyService));
    }

    const weekendExpenses = expenses.filter(e => {
        const day = new Date(e.issuedAt).getDay();
        return day === 0 || day === 6;
    });
    let weekendSpent = 0;
    for (const e of weekendExpenses) weekendSpent += await getAmountNative(e, targetCurrency, currencyService);

    const weekdayCount = expenses.filter(e => { const d = new Date(e.issuedAt).getDay(); return d !== 0 && d !== 6; }).length;
    const avgWeekend = weekendExpenses.length > 0 ? weekendSpent / weekendExpenses.length : 0;
    const avgWeekday = weekdayCount > 0 ? (totalSpent - weekendSpent) / weekdayCount : 0;

    const duplicates = this.detectDuplicateExpenses(expenses);

    return {
        totalSpent: totalSpent.toFixed(2),
        totalIncome: totalIncome.toFixed(2),
        expenseCount: expenses.length,
        byCategory,
        weekendTotal: weekendSpent.toFixed(2),
        weekdayTotal: (totalSpent - weekendSpent).toFixed(2),
        avgWeekend: avgWeekend.toFixed(2),
        avgWeekday: avgWeekday.toFixed(2),
        anomalies: duplicates,
        message: `Gastaste ${targetCurrency} ${totalSpent.toFixed(2)} en ${expenses.length} transacciones. Fin de semana: ${weekendSpent.toFixed(2)}, Entre semana: ${(totalSpent - weekendSpent).toFixed(2)}.`
    };
  }

  private detectDuplicateExpenses(expenses: any[]): any[] {
    const duplicates: any[] = [];
    const byKey: Record<string, any[]> = {};
    for (const e of expenses) {
        const key = `${e.amount}-${e.description?.toLowerCase().substring(0, 20)}`;
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push(e);
    }
    for (const key in byKey) {
        if (byKey[key].length > 1) {
            duplicates.push({ amount: byKey[key][0].amount, count: byKey[key].length, dates: byKey[key].map((e: any) => e.issuedAt) });
        }
    }
    return duplicates;
  }

  private async createRefund(user: any, args: any) {
    const { amount, currency, description, paymentMethodName, originalExpenseId, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    let paymentMethodId = null;
    if (paymentMethodName) {
        const pm = await this.app.prisma.paymentMethod.findFirst({
            where: { userId: user.id, profileId, active: true, name: { contains: paymentMethodName, mode: 'insensitive' } }
        });
        if (pm) paymentMethodId = pm.id;
    }

    if (!paymentMethodId) {
        const defaultPm = await this.app.prisma.paymentMethod.findFirst({
            where: { userId: user.id, active: true, OR: [{ profileId }, { profileId: null }] }
        });
        if (defaultPm) paymentMethodId = defaultPm.id;
    }

    if (!paymentMethodId) {
        return { success: false, message: 'No encontré un método de pago válido para registrar el reembolso.' };
    }

    const targetCurrency = user.preferredCurrency || 'PEN';
    const refundCurrency = currency || targetCurrency;
    const { amount: amountNative, rate } = await this.currencyService.convert(amount, refundCurrency, targetCurrency);

    const income = await this.app.prisma.$transaction(async (tx) => {
        const inc = await tx.income.create({
            data: {
                userId: user.id,
                profileId,
                paymentMethodId,
                amount,
                currency: refundCurrency,
                amountNative,
                exchangeRate: rate,
                description: `Reembolso: ${description}`,
                issuedAt: new Date()
            }
        });

        await tx.paymentMethod.update({
            where: { id: paymentMethodId },
            data: { balance: { increment: amount } }
        });

        return inc;
    });

    return { success: true, message: `Reembolso de ${refundCurrency} ${amount} registrado como ingreso.`, income };
  }

  private async deleteLastNExpenses(user: any, args: any) {
    const { count, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    const lastExpenses = await this.app.prisma.expense.findMany({
        where: { userId: user.id, profileId },
        orderBy: { createdAt: 'desc' },
        take: count
    });

    if (lastExpenses.length === 0) return { success: false, message: 'No hay gastos para eliminar.' };

    const ids = lastExpenses.map(e => e.id);
    await this.app.prisma.expense.deleteMany({ where: { id: { in: ids } } });

    return { success: true, message: `${lastExpenses.length} gastos eliminados.`, deleted: ids };
  }

  private async deleteLastNIncomes(user: any, args: any) {
    const { count, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    const lastIncomes = await this.app.prisma.income.findMany({
        where: { userId: user.id, profileId },
        orderBy: { issuedAt: 'desc' },
        take: count
    });

    if (lastIncomes.length === 0) return { success: false, message: 'No hay ingresos para eliminar.' };

    const ids = lastIncomes.map(i => i.id);
    await this.app.prisma.income.deleteMany({ where: { id: { in: ids } } });

    return { success: true, message: `${lastIncomes.length} ingresos eliminados.`, deleted: ids };
  }

  private async getAnnualSummary(user: any, args: any) {
    const { year, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const targetYear = year || new Date().getFullYear() - 1;
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';

    const start = new Date(targetYear, 0, 1);
    const end = new Date(targetYear, 11, 31, 23, 59, 59);

    const [expenses, incomes] = await Promise.all([
        this.app.prisma.expense.findMany({
            where: { userId: user.id, profileId, issuedAt: { gte: start, lte: end } },
            include: { category: true }
        }),
        this.app.prisma.income.findMany({
            where: { userId: user.id, profileId, issuedAt: { gte: start, lte: end } }
        })
    ]);

    let totalSpent = 0, totalIncome = 0;
    const byCategory: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    for (const e of expenses) {
        const amt = await getAmountNative(e, targetCurrency, currencyService);
        totalSpent += amt;
        const cat = e.category?.name || 'Sin categoría';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
        const monthKey = new Date(e.issuedAt).toLocaleString('default', { month: 'long' });
        byMonth[monthKey] = (byMonth[monthKey] || 0) + amt;
    }

    for (const i of incomes) {
        totalIncome += await getAmountNative(i, targetCurrency, currencyService);
    }

    return {
        year: targetYear,
        totalSpent: totalSpent.toFixed(2),
        totalIncome: totalIncome.toFixed(2),
        netSavings: (totalIncome - totalSpent).toFixed(2),
        byCategory,
        byMonth,
        expenseCount: expenses.length,
        message: `Resumen ${targetYear}: Gastaste ${targetCurrency} ${totalSpent.toFixed(2)}, ingresaste ${totalIncome.toFixed(2)}. Ahorro neto: ${(totalIncome - totalSpent).toFixed(2)}.`
    };
  }

  private async getRecurringExpenses(user: any, args: any) {
    const { profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';

    const expenses = await this.app.prisma.expense.findMany({
        where: { userId: user.id, profileId },
        orderBy: { issuedAt: 'desc' },
        take: 200,
        include: { category: true }
    });

    const merchantCount: Record<string, { count: number; total: number; amounts: number[] }> = {};
    for (const e of expenses) {
        const merchant = e.provider || e.description?.substring(0, 30) || 'Unknown';
        if (!merchantCount[merchant]) merchantCount[merchant] = { count: 0, total: 0, amounts: [] };
        merchantCount[merchant].count++;
        merchantCount[merchant].total += await getAmountNative(e, targetCurrency, currencyService);
        merchantCount[merchant].amounts.push(e.amount);
    }

    const recurring = Object.entries(merchantCount)
        .filter(([_, data]) => data.count >= 2)
        .map(([merchant, data]) => ({
            merchant,
            count: data.count,
            avgAmount: (data.total / data.count).toFixed(2),
            totalYear: data.total.toFixed(2)
        }))
        .sort((a, b) => b.count - a.count);

    const monthlyTotal = recurring.reduce((sum, r) => sum + parseFloat(r.avgAmount), 0);

    return {
        recurring,
        monthlyEstimate: monthlyTotal.toFixed(2),
        message: `Detecté ${recurring.length} gastos recurrentes. Estimado mensual: ${targetCurrency} ${monthlyTotal.toFixed(2)}.`
    };
  }

  private async getWeekendVsWeekdayAnalysis(user: any, args: any) {
    const { month, year, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const expenses = await this.app.prisma.expense.findMany({
        where: { userId: user.id, profileId, issuedAt: { gte: start, lte: end } },
        include: { category: true }
    });

    let weekendSpent = 0, weekdaySpent = 0;
    let weekendCount = 0, weekdayCount = 0;
    for (const e of expenses) {
        const day = new Date(e.issuedAt).getDay();
        const amt = await getAmountNative(e, targetCurrency, currencyService);
        if (day === 0 || day === 6) {
            weekendSpent += amt;
            weekendCount++;
        } else {
            weekdaySpent += amt;
            weekdayCount++;
        }
    }

    return {
        month: m,
        year: y,
        weekend: { total: weekendSpent.toFixed(2), count: weekendCount, avg: weekendCount > 0 ? (weekendSpent / weekendCount).toFixed(2) : '0' },
        weekday: { total: weekdaySpent.toFixed(2), count: weekdayCount, avg: weekdayCount > 0 ? (weekdaySpent / weekdayCount).toFixed(2) : '0' },
        message: `Fines de semana: ${targetCurrency} ${weekendSpent.toFixed(2)} (${weekendCount} gastos). Entre semana: ${targetCurrency} ${weekdaySpent.toFixed(2)} (${weekdayCount} gastos).`
    };
  }

  private async checkIntegrationStatus(user: any) {
    const integrations = await this.app.prisma.emailIntegration.findMany({
        where: { userId: user.id }
    });

    if (integrations.length === 0) {
        return { connected: false, providers: [], message: 'No tienes integraciones de email conectadas.' };
    }

    const status = integrations.map(i => ({
        provider: i.provider,
        email: i.email,
        isActive: i.isActive,
        lastSync: i.lastSync
    }));

    const activeCount = status.filter(s => s.isActive).length;
    return {
        connected: activeCount > 0,
        providers: status,
        message: `Tienes ${activeCount} de ${integrations.length} integraciones activas.`
    };
  }

  private async reconnectIntegration(user: any, args: any) {
    const { provider } = args;
    return {
        success: true,
        instructions: [
            `1. Ve a ${config.frontendUrl}/integrations`,
            `2. Busca "${provider}" en la lista de integraciones`,
            '3. Si aparece como "desconectado", haz clic en "Reconectar"',
            '4. Autoriza nuevamente el acceso en el popup de Google/Microsoft',
            '5. Espera la confirmación de sincronización'
        ],
        message: `Sigue estos pasos para reconectar tu integración de ${provider}.`
    };
  }

  private async getExchangeRate(user: any, args: any) {
    const { fromCurrency, toCurrency, amount } = args;
    const from = fromCurrency || 'USD';
    const to = toCurrency || 'PEN';

    const rate = await this.currencyService.getExchangeRate(from, to);
    const convertedAmount = amount ? await this.currencyService.convert(amount, from, to) : null;

    return {
        from,
        to,
        rate: rate.toFixed(4),
        amount: amount || null,
        converted: convertedAmount ? convertedAmount.amount.toFixed(2) : null,
        message: convertedAmount
            ? `${amount} ${from} = ${convertedAmount.amount.toFixed(2)} ${to} (tipo de cambio: ${rate.toFixed(4)})`
            : `Tipo de cambio actual: 1 ${from} = ${rate.toFixed(4)} ${to}`
    };
  }

  private async createPaymentMethod(user: any, args: any) {
    const { name, provider, type, currency, profileName, initialBalance } = args;
    const profileId = this.resolveProfileId(user, profileName);

    // Verificar si ya existe un método de pago con ese nombre en CUALQUIER perfil del usuario
    const existingPm = await this.app.prisma.paymentMethod.findFirst({
        where: {
            userId: user.id,
            name: { equals: name, mode: 'insensitive' },
            active: true
        },
        include: { Profile: true }
    });

    if (existingPm) {
        const pName = (existingPm as any).Profile?.name || 'General';
        return { 
            success: false, 
            message: `Ya existe un método de pago activo con el nombre "${name}" en el perfil "${pName}". Los nombres de métodos de pago deben ser únicos en toda tu cuenta para evitar confusiones.` 
        };
    }

    const pmCurrency = currency || user.preferredCurrency || 'PEN';

    const pm = await this.app.prisma.$transaction(async (tx) => {
        const newPm = await tx.paymentMethod.create({
            data: {
                userId: user.id,
                profileId,
                name,
                provider,
                type,
                currency: pmCurrency,
                balance: initialBalance || 0
            }
        });

        if (initialBalance && initialBalance > 0) {
            const targetCurrency = user.preferredCurrency || 'PEN';
            const { amount: amountNative, rate: exchangeRate } = await this.currencyService.convert(initialBalance, pmCurrency, targetCurrency);

            await tx.income.create({
                data: {
                    userId: user.id,
                    profileId,
                    paymentMethodId: newPm.id,
                    amount: initialBalance,
                    currency: pmCurrency,
                    amountNative,
                    exchangeRate,
                    description: 'Saldo inicial',
                    issuedAt: new Date()
                }
            });
        }

        return newPm;
    });

    let msg = `Método de pago "${pm.name}" creado en el perfil "${profileName || 'actual'}"`;
    if (initialBalance) msg += ` con un saldo inicial de ${pmCurrency} ${initialBalance}.`;
    else msg += `.`;

    return { success: true, message: msg };
  }

  private async getFinancialReport(user: any, args: any) {
    const now = new Date();
    const month = args.month || (now.getMonth() + 1);
    const year = args.year || now.getFullYear();
    const profileId = this.resolveProfileId(user, args.profileName);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 1. Get Budget (General)
    const budget = await this.app.prisma.budget.findFirst({
        where: { userId: user.id, profileId, month, year }
    });

    // 1.5 Get Category Budgets
    const categoryBudgets = await this.app.prisma.budget.findMany({
        where: { userId: user.id, profileId, year, month, target: 'CATEGORY' },
        include: { category: true }
    });
    
    // Map for easy lookup: categoryName -> BudgetObject
    const catBudgetMap: Record<string, any> = {};
    categoryBudgets.forEach(cb => {
        const catName = cb.category?.name;
        if (catName) {
            catBudgetMap[catName] = cb;
        }
    });

    // 2. Get Expenses
    const expenses = await this.app.prisma.expense.findMany({
        where: {
            userId: user.id,
            profileId,
            issuedAt: {
                gte: startDate,
                lte: endDate
            }
        },
        include: { category: true }
    });

    // 3. Calculate Totals
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';
    
    let totalSpent = 0;
    for (const e of expenses) {
        totalSpent += await getAmountNative(e, targetCurrency, currencyService);
    }
    
    // 4. Group by Category
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
        const catName = e.category?.name || 'Sin Categoría';
        const amount = await getAmountNative(e, targetCurrency, currencyService);
        byCategory[catName] = (byCategory[catName] || 0) + amount;
    }

    // Sort categories
    const topCategories = Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([name, amount]) => {
            const cb = catBudgetMap[name];
            return { 
                name, 
                amount,
                budget: cb ? cb.amount : null,
                remaining: cb ? (cb.amount - amount) : null,
                status: cb ? (amount > cb.amount ? 'EXCEEDED' : (amount >= cb.amount * (cb.alertThreshold || 0.8) ? 'WARNING' : 'OK')) : 'NO_LIMIT'
            };
        });
    
    // Add categories that have budget but NO expenses yet
    categoryBudgets.forEach(cb => {
        const name = cb.category?.name;
        if (name && !byCategory[name]) {
            topCategories.push({
                name,
                amount: 0,
                budget: cb.amount,
                remaining: cb.amount,
                status: 'OK'
            });
        }
    });

    return {
        period: `${month}/${year}`,
        currency: user.preferredCurrency,
        budget: budget ? { 
            limit: budget.amount, 
            spent: totalSpent, 
            remaining: Number(budget.amount) - totalSpent,
            alertThreshold: budget.alertThreshold 
        } : 'No definido',
        totalSpent,
        categories: topCategories, // Renamed for clarity, though keeping topCategories var name is fine
        expenseCount: expenses.length,
        message: 'Reporte generado. Úsalo para dar consejos detallados por categoría.'
    };
  }

  private async createSavingsGoal(user: any, args: any) {
    const { name, targetAmount, currency, deadline, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const goal = await this.app.prisma.savingsGoal.create({
        data: {
            userId: user.id,
            profileId,
            name,
            targetAmount,
            currency: currency || user.preferredCurrency,
            deadline: deadline ? new Date(deadline) : null
        }
    });
    return { success: true, message: `Meta de ahorro "${goal.name}" creada. Objetivo: ${goal.currency} ${goal.targetAmount}` };
  }

  private async addSavingsTransaction(user: any, args: any) {
    const { goalName, amount, type, description, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    
    // Find goal (fuzzy match)
    const goal = await this.app.prisma.savingsGoal.findFirst({
      where: {
        userId: user.id,
        profileId,
        status: { not: 'ARCHIVED' },
        name: { contains: goalName, mode: 'insensitive' }
      }
    });

    if (!goal) return { success: false, message: `No encontré la meta "${goalName}".` };

    // Create transaction
    await this.app.prisma.savingsTransaction.create({
      data: {
        goalId: goal.id,
        amount,
        type,
        description
      }
    });

    // Update goal
    const newTotal = goal.currentAmount + amount;
    await this.app.prisma.savingsGoal.update({
      where: { id: goal.id },
      data: { 
        currentAmount: newTotal,
        status: newTotal >= goal.targetAmount ? 'COMPLETED' : 'ACTIVE'
      }
    });

    // Handle Create Expense if requested
    if (type === 'WITHDRAWAL' && args.createExpense) {
        const expenseAmount = Math.abs(amount);
        let categoryId = null;
        
        if (args.categoryName) {
            const cat = await this.app.prisma.category.findFirst({
                where: { userId: user.id, profileId, name: { equals: args.categoryName, mode: 'insensitive' } }
            });
            if (cat) categoryId = cat.id;
        }

        await this.app.prisma.expense.create({
            data: {
                userId: user.id,
                profileId,
                amount: expenseAmount,
                currency: goal.currency,
                description: description || `Gasto desde ahorro: ${goal.name}`,
                type: 'INFORMAL',
                source: 'SAVINGS' as any,
                categoryId: categoryId,
                issuedAt: args.expenseDate ? new Date(args.expenseDate) : new Date(),
                provider: 'Ahorros', 
            }
        });
        return { 
            success: true, 
            message: `Retiro de ${goal.currency} ${Math.abs(amount)} registrado en "${goal.name}". También se creó el gasto en el historial. Nuevo saldo: ${newTotal}.` 
        };
    }

    return { 
      success: true, 
      message: `Registrado ${amount > 0 ? 'depósito' : 'retiro'} de ${goal.currency} ${Math.abs(amount)} en "${goal.name}". Nuevo saldo: ${newTotal}.` 
    };
  }

  private async deleteSavingsGoal(user: any, args: any) {
    const { goalName, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const goal = await this.app.prisma.savingsGoal.findFirst({
        where: { 
            userId: user.id, 
            profileId,
            name: { contains: goalName, mode: 'insensitive' },
            status: { not: 'ARCHIVED' }
        }
    });

    if (!goal) return { success: false, message: 'No encontré esa meta de ahorro.' };

    await this.app.prisma.savingsGoal.delete({ where: { id: goal.id } });
    return { success: true, message: `Meta de ahorro "${goal.name}" eliminada correctamente.` };
  }

  private async getSavingsStatus(user: any, args: any) {
    const { goalName, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    const where: any = { userId: user.id, profileId, status: { not: 'ARCHIVED' } };
    
    if (goalName) {
      where.name = { contains: goalName, mode: 'insensitive' };
    }

    const goals = await this.app.prisma.savingsGoal.findMany({ where });
    
    if (goals.length === 0) return { message: 'No tienes metas de ahorro activas.' };

    return {
      goals: goals.map(g => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        currency: g.currency,
        progress: Math.round((g.currentAmount / g.targetAmount) * 100) + '%'
      }))
    };
  }

  private async getPaymentMethods(user: any, args: any) {
    const profileId = this.resolveProfileId(user, args.profileName);
    
    // 1. Obtener métodos del perfil actual
    const methods = await this.app.prisma.paymentMethod.findMany({
      where: { 
        userId: user.id, 
        active: true,
        OR: [{ profileId }, { profileId: null }]
      }
    });

    // 2. Obtener TODOS los métodos del usuario (para depuración de "fantasmas")
    const allMethods = await this.app.prisma.paymentMethod.findMany({
      where: { userId: user.id, active: true },
      include: { Profile: true }
    });

    if (allMethods.length === 0) {
      return { message: "No se encontraron métodos de pago activos en ninguna cuenta." };
    }

    return {
      currentProfileMethods: methods.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        profile: m.profileId ? 'Perfil Específico' : 'General'
      })),
      allUserMethods: allMethods.map((m: any) => ({
        id: m.id,
        name: m.name,
        profileName: m.Profile?.name || 'General',
        isActive: m.active
      })),
      message: `He consultado la base de datos en tiempo real. En el perfil actual tienes ${methods.length} métodos, pero en total en tu cuenta hay ${allMethods.length}. Confía SOLO en esta lista.`
    };
  }

  private async checkMonthlySurplus(user: any, args: any) {
    const now = new Date();
    const profileId = this.resolveProfileId(user, args?.profileName);
    // Check previous month
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    const targetMonth = prevDate.getMonth() + 1; // 1-12
    const targetYear = prevDate.getFullYear();

    const budget = await this.app.prisma.budget.findFirst({
        where: { userId: user.id, profileId, month: targetMonth, year: targetYear }
    });

    if (!budget) return { message: `No encontré presupuesto para el mes anterior (${targetMonth}/${targetYear}).` };

    // Calculate spent
    const start = new Date(targetYear, targetMonth - 1, 1);
    const end = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    
    const expenses = await this.app.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, profileId, issuedAt: { gte: start, lte: end } }
    });

    const spent = expenses._sum.amount || 0;
    const surplus = budget.amount - spent;

    if (surplus > 0) {
        return {
            hasSurplus: true,
            month: `${targetMonth}/${targetYear}`,
            budget: budget.amount,
            spent,
            surplus,
            message: `¡Hubo superávit en ${targetMonth}/${targetYear}! Presupuesto: ${budget.amount}, Gastado: ${spent}, Sobrante: ${surplus}. Pregunta al usuario si quiere ahorrarlo.`
        };
    } else {
        return {
            hasSurplus: false,
            month: `${targetMonth}/${targetYear}`,
            message: `No hubo excedente en ${targetMonth}/${targetYear}. Gastaste ${spent} de ${budget.amount}.`
        };
    }
  }

  private async deletePaymentMethod(user: any, args: any) {
    const { name, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);
    
    // 1. Buscar en el perfil actual
    let pm = await this.app.prisma.paymentMethod.findFirst({
        where: { userId: user.id, profileId, name: { contains: name, mode: 'insensitive' }, active: true }
    });

    // 2. Si no se encuentra, buscar globalmente para informar al usuario
    if (!pm) {
        const globalPm = await this.app.prisma.paymentMethod.findFirst({
            where: { userId: user.id, name: { contains: name, mode: 'insensitive' }, active: true },
            include: { Profile: true }
        });

        if (globalPm) {
            const pName = (globalPm as any).Profile?.name || 'General';
            return { 
                success: false, 
                message: `No encontré "${name}" en el perfil actual, pero existe en el perfil "${pName}". Por favor, especifica el perfil o cámbiate a él para eliminarlo.` 
            };
        }

        return { success: false, message: `No encontré ningún método de pago activo llamado "${name}" en ninguna de tus cuentas.` };
    }

    // Hard delete: eliminar método de pago Y todos sus ingresos/gastos asociados
    await this.app.prisma.$transaction(async (tx) => {
        await tx.expense.deleteMany({ where: { paymentMethodId: pm!.id } });
        await tx.income.deleteMany({ where: { paymentMethodId: pm!.id } });
        await tx.paymentMethod.delete({ where: { id: pm!.id } });
    });

    return { success: true, message: `Método de pago "${pm.name}" y todos sus registros asociados eliminados definitivamente.` };
  }

 private async getPendingExpenses(user: any) {
    try {
      const pending = await this.app.prisma.pendingExpense.findMany({
        where: { userId: user.id, status: 'WAITING_USER' },
        orderBy: { createdAt: 'asc' }
      });

      if (pending.length === 0) {
        return { message: "No tienes ningún gasto pendiente por aprobar." };
      }

      const formatted = pending.map((p: any, index: number) => ({
        index: index + 1,
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        description: p.description || p.rawText || 'Sin descripción',
        date: p.date ? formatDMY(p.date) : 'No especificada',
        source: p.source
      }));

      // Save state to Redis so the user can approve/reject in the next message
      const redis = getRedis(this.app);
      if (redis) {
          const state = {
              action: 'WAITING_EXPENSE_APPROVAL',
              pendingExpenses: pending.map((p: any) => ({
                  id: p.id,
                  context: {
                      amount: p.amount,
                      currency: p.currency,
                      description: p.description || p.rawText || 'Sin descripción',
                      date: p.date ? formatDMY(p.date) : 'No especificada',
                      source: p.source
                  }
              }))
          };
          await redis.set(`chat_state:${user.id}`, JSON.stringify(state), 'EX', 3600); // 1 hour TTL
      }

      return {
        message: `Dile al usuario de forma muy cálida, amigable y con humor (ej. "¡Oye ${user.name ? user.name.split(' ')[0] : 'amigo'}! Veo que tienes...") que tiene ${pending.length} gasto(s) pendiente(s). Sugiérele amablemente que responda "Aprobar todo", "Rechazar el 1", "Aprobar el 2", etc.`,
        pendingExpenses: formatted
      };
    } catch (e: any) {
      this.app.log.error({ msg: 'Error getPendingExpenses', error: e });
      throw new Error(`Error al obtener gastos pendientes: ${e.message}`);
    }
  }

  private async getRecentExpenses(user: any, args: any) {
    const limit = args.limit || 20;
    const profileId = this.resolveProfileId(user, args.profileName);
    const where: any = { userId: user.id, profileId };
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end: Date | null = null;

    // 1. Explicit Month/Year (Priority over default, but under explicit start/end dates)
    if (args.month) {
        const y = args.year || now.getFullYear();
        start = new Date(y, args.month - 1, 1);
        end = new Date(y, args.month, 0, 23, 59, 59, 999); // End of that month
    }

    // 2. Explicit Start/End Date (Highest priority)
    if (args.startDate) {
        start = new Date(args.startDate);
        // If start is provided but no end, default end is undefined (open) or logic below
    }
    
    const dateFilter: any = {};

    // Apply Start Date
    if (!args.fetchAll) {
        dateFilter.gte = start;
    }

    // Apply End Date
    if (args.endDate) {
        const e = new Date(args.endDate);
        if (args.endDate.length === 10) { 
            e.setHours(23, 59, 59, 999);
        }
        dateFilter.lte = e;
    } else if (end && !args.fetchAll) {
        // If we calculated an end date from month/year logic
        dateFilter.lte = end;
    }

    if (Object.keys(dateFilter).length > 0) {
        where.OR = [
            { issuedAt: dateFilter },
            { createdAt: dateFilter }
        ];
    }

    if (args.type) {
        where.type = args.type;
    }

    const orderBy: any = {};
    if (args.sortBy === 'created') {
        orderBy.createdAt = 'desc';
    } else {
        orderBy.issuedAt = 'desc';
    }

    const expenses = await this.app.prisma.expense.findMany({
        where,
        orderBy,
        take: limit,
        include: { category: true, paymentMethod: true }
    });

    if (expenses.length === 0) {
        return { message: 'No se encontraron gastos en el periodo solicitado.' };
    }

    const list = expenses.map(e => {
        const dateObj = new Date(e.issuedAt);
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const shortDate = `${day}/${month}`;
        
        return {
            id: e.id,
            fecha: shortDate, // Short format for the agent to use directly if needed
            fullDate: formatDMY(e.issuedAt),
            monto: e.amount,
            moneda: e.currency,
            descripcion: e.description,
            proveedor: e.provider,
            categoria: e.category?.name || 'General',
            metodo: e.paymentMethod?.name || 'Otros',
            tipo: e.type
        };
    });

    return { 
        count: expenses.length, 
        expenses: list,
        message: 'Lista de gastos recuperada. Formatea esta lista según las instrucciones de estilo (minimalista, emojis monocromáticos).' 
    };
  }

  private async getBudget(user: any, args: any) {
    const now = new Date();
    const month = args.month || now.getMonth() + 1;
    const year = args.year || now.getFullYear();
    const profileId = this.resolveProfileId(user, args.profileName);

    const budget = await this.app.prisma.budget.findFirst({
        where: { userId: user.id, profileId, year, month, target: 'GENERAL' }
    });

    if (!budget) return { message: `No tienes presupuesto definido para ${month}/${year}.` };
    
    // Calculate spent
    // This requires aggregation.
    const expenses = await this.app.prisma.expense.findMany({
        where: {
            userId: user.id,
            profileId,
            issuedAt: {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1)
            }
        }
    });
    const currencyService = new CurrencyService(this.app);
    const targetCurrency = user.preferredCurrency || 'PEN';
    
    let totalSpent = 0;
    for (const e of expenses) {
        totalSpent += await getAmountNative(e, targetCurrency, currencyService);
    }

    return { 
        limit: budget.amount, 
        spent: totalSpent, 
        remaining: budget.amount - totalSpent,
        currency: targetCurrency, // Usar siempre targetCurrency (unificado)
        alertThreshold: budget.alertThreshold
    };
  }

  private async updateBudget(user: any, args: any) {
    const now = new Date();
    const month = args.month || now.getMonth() + 1;
    const year = args.year || now.getFullYear();
    const amount = args.amount;
    const alertThreshold = args.alertThreshold;
    const profileId = this.resolveProfileId(user, args.profileName);

    // Ensure budget exists (fix param order: year, month)
    const budget = await ensureBudgetForUserMonth(this.app, user.id, profileId, year, month, false);
    
    const data: any = {};
    if (amount !== undefined) data.amount = amount;
    if (alertThreshold !== undefined) data.alertThreshold = alertThreshold;

    if (Object.keys(data).length === 0) {
        return { success: true, message: `Presupuesto para ${month}/${year} sin cambios: Monto ${budget.currency} ${budget.amount}` };
    }

    const updated = await this.app.prisma.$transaction(async (tx: any) => {
        const b = await tx.budget.update({
            where: { id: budget.id },
            data
        });

        if (amount !== undefined && amount !== budget.amount) {
            await tx.budgetLog.create({
                data: {
                    budgetId: b.id,
                    userId: user.id,
                    profileId,
                    amount: amount - budget.amount,
                    previousTotal: budget.amount,
                    newTotal: amount,
                    reason: 'Actualización manual de presupuesto',
                    type: 'MANUAL_SET'
                }
            });
        }
        return b;
    });

    return { success: true, message: `Presupuesto para ${month}/${year} actualizado: Monto ${updated.currency} ${updated.amount}` + (updated.alertThreshold ? ` (Alerta al ${(updated.alertThreshold * 100).toFixed(0)}%)` : '') };
  }

  private async adjustBudgetFunds(user: any, args: any) {
    const { amount, type, reason, month: m, year: y, profileName } = args;
    const now = new Date();
    const month = m || now.getMonth() + 1;
    const year = y || now.getFullYear();
    const profileId = this.resolveProfileId(user, profileName);

    const budget = await ensureBudgetForUserMonth(this.app, user.id, profileId, year, month, true);

    const adjustment = type === 'CUT' ? -Math.abs(amount) : Math.abs(amount);
    const previousTotal = budget.amount;
    const newTotal = previousTotal + adjustment;

    if (newTotal < 0) {
        return { success: false, message: `No puedes recortar más fondos de los disponibles. Presupuesto actual: ${budget.currency} ${previousTotal}` };
    }

    await this.app.prisma.$transaction(async (tx: any) => {
        await tx.budget.update({
            where: { id: budget.id },
            data: { amount: newTotal }
        });

        await tx.budgetLog.create({
            data: {
                budgetId: budget.id,
                userId: user.id,
                profileId,
                amount: adjustment,
                previousTotal,
                newTotal,
                reason: reason || (type === 'ADD' ? 'Aumento de fondos' : 'Recorte de fondos'),
                type: type === 'ADD' ? 'INCREASE' : 'DECREASE'
            }
        });
    });

    return { success: true, message: `Presupuesto ajustado exitosamente. Nuevo total: ${budget.currency} ${newTotal.toFixed(2)}` };
  }

  private async getBudgetHistory(user: any, args: any) {
    const { month: m, year: y, profileName } = args;
    const now = new Date();
    const month = m || now.getMonth() + 1;
    const year = y || now.getFullYear();
    const profileId = this.resolveProfileId(user, profileName);

    const budget = await this.app.prisma.budget.findFirst({
        where: { userId: user.id, profileId, month, year },
        include: { logs: { orderBy: { createdAt: 'desc' } } }
    });

    if (!budget || !budget.logs || budget.logs.length === 0) {
        return { success: true, message: `No hay historial de cambios para el presupuesto de ${month}/${year}.` };
    }

    const history = budget.logs.map((log: any) => {
        const sign = log.amount >= 0 ? '+' : '';
        return `📅 ${formatDMY(log.createdAt)}: ${sign}${budget.currency} ${log.amount.toFixed(2)} (${log.reason})`;
    }).join('\n');

    return { success: true, message: `Historial de cambios (${month}/${year}):\n━━━━━━━━━━━━━━━\n${history}` };
  }

  private async manageCategoryBudget(user: any, args: any) {
    const { categoryName, amount, alertThreshold, month: m, year: y, profileName } = args;
    const now = new Date();
    const month = m || now.getMonth() + 1;
    const year = y || now.getFullYear();
    const profileId = this.resolveProfileId(user, profileName);

    const category = await this.app.prisma.category.findFirst({
        where: { userId: user.id, profileId, name: { contains: categoryName, mode: 'insensitive' } }
    });
    
    if (!category) {
        return { success: false, message: `No encontré la categoría "${categoryName}". Por favor créala primero.` };
    }

    // Ensure main budget exists
    const generalBudget = await ensureBudgetForUserMonth(this.app, user.id, profileId, year, month, false);

    const data: any = {
        userId: user.id,
        profileId,
        categoryId: category.id,
        target: 'CATEGORY',
        year,
        month
    };
    
    const existing = await this.app.prisma.budget.findFirst({
        where: { userId: user.id, profileId, year, month, target: 'CATEGORY', categoryId: category.id }
    });

    if (amount !== undefined) data.amount = amount;
    else if (!existing) data.amount = 0; // Default for new

    if (alertThreshold !== undefined) data.alertThreshold = alertThreshold;
    if (!existing && !data.currency) data.currency = user.preferredCurrency;

    let result;
    if (existing) {
        result = await this.app.prisma.budget.update({ where: { id: existing.id }, data });
    } else {
        result = await this.app.prisma.budget.create({ data });
    }
    
    return { success: true, message: `Presupuesto para categoría "${category.name}" (${month}/${year}) actualizado a ${result.currency} ${result.amount}` + (result.alertThreshold ? ` (Alerta: ${(result.alertThreshold * 100).toFixed(0)}%)` : '') };
  }

  private async setDefaultPaymentMethod(user: any, args: any) {
    const { paymentMethodName, profileName } = args;
    const profileId = this.resolveProfileId(user, profileName);

    const pm = await this.app.prisma.paymentMethod.findFirst({
        where: { userId: user.id, profileId, name: { contains: paymentMethodName, mode: 'insensitive' }, active: true }
    });

    if (!pm) {
        return { success: false, message: `No encontré el método de pago "${paymentMethodName}" en el perfil actual.` };
    }

    await this.app.prisma.user.update({
        where: { id: user.id },
        data: { defaultPaymentMethodId: pm.id }
    });

    return { 
        success: true, 
        message: `He establecido "${pm.name}" como tu método de pago principal (por defecto) para este perfil.` 
    };
  }

  private async managePaymentMethodBudget(user: any, args: any) {
    return { success: false, message: 'La funcionalidad de asignar presupuestos a métodos de pago específicos ha sido descontinuada. Utiliza únicamente presupuestos mensuales generales o por categorías.' };
  }

  private async getSubscriptionStatus(user: any) {
    const now = new Date();
    let status = 'FREE';
    let message = 'Actualmente tienes el plan GRATUITO.';
    let daysLeft = 0;

    if (user.plan === 'LIFETIME') {
        return { plan: 'LIFETIME', message: '¡Tienes acceso DE POR VIDA! No necesitas renovar nunca. 🎉' };
    }

    if (user.plan === 'PREMIUM') {
        if (user.planExpires && new Date(user.planExpires) > now) {
            const diff = new Date(user.planExpires).getTime() - now.getTime();
            daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
            return { 
                plan: 'PREMIUM', 
                expires: user.planExpires, 
                daysLeft,
                message: `Tienes plan PREMIUM activo. Vence en ${daysLeft} días (${formatDMY(user.planExpires)}).` 
            };
        } else {
            // Expired premium
            return { plan: 'FREE', message: 'Tu plan PREMIUM ha expirado. Estás en el plan GRATUITO actualmente.' };
        }
    }

    // Check Trial
    if (user.trialEnds && new Date(user.trialEnds) > now) {
        const diff = new Date(user.trialEnds).getTime() - now.getTime();
        daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
        return { 
            plan: 'TRIAL', 
            expires: user.trialEnds, 
            daysLeft,
            message: `Estás en periodo de PRUEBA (Trial). Te quedan ${daysLeft} días de acceso Premium gratuito.` 
        };
    } else if (user.trialEnds) {
         return { plan: 'FREE', message: 'Tu periodo de prueba ha finalizado.' };
    }

    return { plan: 'FREE', message: 'Tienes el plan GRATUITO. Pásate a Premium para funciones ilimitadas.' };
  }



  private async updateUserConfig(user: any, args: any) {
    const { language, birthDate } = args;
    const data: any = {};
    const messages = [];

    if (language && ['es', 'en', 'pt'].includes(language)) {
        data.language = language;
        const langNames = { es: 'Español', en: 'English', pt: 'Português' };
        messages.push(`Idioma actualizado a ${langNames[language as keyof typeof langNames]}.`);
    }

    if (birthDate) {
        // Validate date format YYYY-MM-DD
        const date = new Date(birthDate);
        if (!isNaN(date.getTime())) {
            data.birthDate = date;
            messages.push(`Fecha de nacimiento actualizada a ${formatDMY(date)}.`);
        } else {
            return { success: false, message: 'Fecha de nacimiento inválida. Usa el formato YYYY-MM-DD.' };
        }
    }

    if (Object.keys(data).length === 0) {
        return { success: false, message: 'No se proporcionaron datos válidos para actualizar.' };
    }

    await this.app.prisma.user.update({
        where: { id: user.id },
        data
    });

    return { success: true, message: messages.join(' ') };
  }

  private async updateAntExpenseConfig(user: any, args: any) {
    const { amountLimit, streakAlert, countAlert, enabled } = args;
    const data: any = {};
    const messages = [];

    if (amountLimit !== undefined) {
        data.antExpenseLimit = amountLimit;
        messages.push(`Límite de gasto hormiga actualizado a ${user.preferredCurrency} ${amountLimit}.`);
    }

    if (streakAlert !== undefined) {
        data.antExpenseStreakAlert = streakAlert > 0 ? streakAlert : null;
        if (streakAlert > 0) messages.push(`Alerta de racha activada: te avisaré tras ${streakAlert} gastos hormiga seguidos.`);
        else messages.push(`Alerta de racha desactivada.`);
    }

    if (countAlert !== undefined) {
        data.antExpenseCountAlert = countAlert > 0 ? countAlert : null;
        if (countAlert > 0) messages.push(`Alerta de frecuencia activada: te avisaré cada ${countAlert} gastos hormiga acumulados.`);
        else messages.push(`Alerta de frecuencia desactivada.`);
    }

    if (enabled !== undefined) {
        data.antExpenseEnabled = enabled;
        messages.push(`Detección de gastos hormiga ${enabled ? 'ACTIVADA' : 'DESACTIVADA'}.`);
    }

    if (Object.keys(data).length === 0) {
        return { success: false, message: 'No se proporcionaron cambios válidos.' };
    }

    await this.app.prisma.user.update({
        where: { id: user.id },
        data
    });

    return { success: true, message: messages.join('\n') };
  }

  private async updateUserProfile(userId: string, args: any) {
    const currentContext: any = await this.getAgentContext(userId) || {};
    const profile = currentContext.profile || {};
    
    if (args.nationality) profile.nationality = args.nationality;
    
    if (args.interests && Array.isArray(args.interests)) {
        // Merge interests instead of overwriting completely if they already exist
        const currentInterests = Array.isArray(profile.interests) ? profile.interests : [];
        const newInterests = args.interests.filter((i: string) => !currentInterests.includes(i));
        profile.interests = [...currentInterests, ...newInterests];
    }
    
    if (args.profession) profile.profession = args.profession;
    if (args.other) profile.other = args.other;

    await this.updateAgentContext(userId, { ...currentContext, profile });
    return { success: true, message: 'Perfil de usuario actualizado con éxito. Usa estos datos para ser más amigable y personalizado en tus próximas respuestas.' };
  }

  private async getUnlinkInstructions(user: any) {
      const link = `${config.frontendUrl}/account`; // Or /integrations
      return { 
          success: true, 
          message: `Para desvincular tu cuenta de WhatsApp o Telegram, por favor visita tu perfil en nuestra plataforma web:\n👉 ${link}\n\nAllí encontrarás la opción "Integraciones" para gestionar tus conexiones.`
      };
  }

  private async getAgentContext(userId: string) {
    const record = await this.app.prisma.agentContext.findUnique({
      where: { userId }
    });
    return record?.data || null;
  }

  private async updateAgentContext(userId: string, data: any) {
    return this.app.prisma.agentContext.upsert({
      where: { userId },
      create: { userId, data },
      update: { data }
    });
  }

  private async clearAgentContext(userId: string) {
    try {
      await this.app.prisma.agentContext.delete({
        where: { userId }
      });
    } catch (e) {
      // Ignore if record doesn't exist
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });
        return response.data[0].embedding;
    } catch (e) {
        console.error('Error getting embedding:', e);
        return [];
    }
  }

  private async saveMemory(userId: string, content: string, role: string) {
    // Prevent saving very short, meaningless messages like "ok", "gracias", "?"
    if (!content || content.trim().length < 10) return;
    
    // Ignore common generic tool outputs if they accidentally reach here
    if (content.includes('{"error":') || content.includes('{"success":')) return;

    const embedding = await this.getEmbedding(content);
    if (!embedding || embedding.length === 0) return;
    
    await this.app.prisma.chatMemory.create({
        data: {
            userId,
            content,
            role,
            embedding
        }
    });
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public async searchMemory(userId: string, query: string, limit = 5): Promise<any[]> {
    const queryEmbedding = await this.getEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) return [];

    // Fetch all user memories (could be optimized later or limited by date)
    const memories = await this.app.prisma.chatMemory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200 // Analyze last 200 memories to avoid huge memory footprint
    });

    const scoredMemories = memories.map(m => {
        const similarity = this.cosineSimilarity(queryEmbedding, m.embedding);
        return { ...m, similarity };
    });

    // Filter by threshold and get top K
    return scoredMemories
        .filter(m => m.similarity > 0.4) // Threshold to ensure relevance
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
  }

  private async loadHistory(userId: string, profileId?: string): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    try {
        const key = profileId ? `chat_history_${userId}_${profileId}` : `chat_history_${userId}`;
        const cache = await this.app.prisma.aiCache.findUnique({
            where: { key }
        });
        if (!cache || !cache.value) return [];
        
        const messages = cache.value as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        
        // Sanitize History
        
        // 1. Remove leading orphaned tool messages (caused by slicing)
        while (messages.length > 0 && messages[0].role === 'tool') {
            messages.shift();
        }

        // 2. Remove trailing incomplete tool sequences (interrupted flows)
        // If history ends with a tool call or tool response, it's missing the final assistant response.
        while (messages.length > 0) {
            const last = messages[messages.length - 1];
            const isTool = last.role === 'tool';
            const isUnansweredAssistant = (last.role === 'assistant' && Array.isArray(last.tool_calls) && last.tool_calls.length > 0);
            
            if (isTool || isUnansweredAssistant) {
                messages.pop();
            } else {
                break;
            }
        }

        return messages;
    } catch (e) {
        console.error('Error loading history:', e);
        return [];
    }
  }

  private async saveHistory(userId: string, history: OpenAI.Chat.Completions.ChatCompletionMessageParam[], profileId?: string) {
    try {
        const key = profileId ? `chat_history_${userId}_${profileId}` : `chat_history_${userId}`;
        const limitedHistory = history.slice(-10);
        await this.app.prisma.aiCache.upsert({
            where: { key },
            create: {
                key,
                value: limitedHistory as any,
                ttl: 60 * 60 * 24 * 30 // 30 days
            },
            update: {
                value: limitedHistory as any,
                ttl: 60 * 60 * 24 * 30
            }
        });
    } catch (e) {
        console.error('Error saving history:', e);
    }
  }
  private async sendFinancialReport(user: any, args: any) {
    const reportJob = new DailyReportJob(this.app);
    const report = await reportJob.generateReportForUser(user);
    if (report) {
      return { success: true, message: report.greeting, buffer: report.buffer };
    }
    return { error: 'No se pudo generar el reporte financiero en este momento.' };
  }

  private async updateNotificationPreferences(user: any, args: any) {
    const updateData: any = {};
    if (args.whatsappEnabled !== undefined) updateData.notifyEmailExpenseWhatsApp = args.whatsappEnabled;
    if (args.telegramEnabled !== undefined) updateData.notifyEmailExpenseTelegram = args.telegramEnabled;
    if (args.reportFrequency !== undefined) updateData.reportFrequency = args.reportFrequency;

    if (Object.keys(updateData).length === 0) {
       return { success: false, message: 'No se enviaron preferencias válidas para actualizar.' };
    }

    try {
        await this.app.prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
        return { success: true, message: 'Preferencias de notificación y reporte actualizadas exitosamente.' };
    } catch (e: any) {
        return { error: 'Error al actualizar preferencias: ' + e.message };
    }
  }
}

async function checkAntExpenses(app: FastifyInstance, user: any, profileId: string): Promise<string | null> {
    if (user.antExpenseEnabled === false) return null;

    const limit = user.antExpenseLimit || 50.0;
    const streakThreshold = user.antExpenseStreakAlert;
    const countThreshold = user.antExpenseCountAlert;

    const now = new Date();
    let alertMessage = null;

    // Check Count Alert (Every X records)
    if (countThreshold && countThreshold > 0) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const whereAnt = {
            userId: user.id,
            profileId,
            issuedAt: { gte: startOfMonth },
            OR: [
                { amountNative: { not: null, lt: limit } },
                { amountNative: null, amount: { lt: limit } }
            ]
        };

        const monthlyAntExpensesCount = await app.prisma.expense.count({ where: whereAnt });

        if (monthlyAntExpensesCount > 0 && monthlyAntExpensesCount % countThreshold === 0) {
             const expenses = await app.prisma.expense.findMany({
                where: whereAnt,
                select: { amount: true, amountNative: true, currency: true, exchangeRate: true }
             });
             const currencyService = new CurrencyService(app);
             const targetCurrency = user.preferredCurrency || 'PEN';
             let total = 0;
             for (const e of expenses) {
                 total += await getAmountNative(e, targetCurrency, currencyService);
             }
             alertMessage = `🔔 Alerta de Frecuencia: Has acumulado ${monthlyAntExpensesCount} gastos hormiga (< ${limit}) este mes, sumando ${targetCurrency} ${total.toFixed(2)}.`;
        }
    }

    // Check Streak Alert (X consecutive records)
    if (streakThreshold && streakThreshold > 0) {
        // Fetch last N expenses
        const lastExpenses = await app.prisma.expense.findMany({
            where: { userId: user.id, profileId },
            orderBy: { issuedAt: 'desc' }, 
            take: streakThreshold
        });

        if (lastExpenses.length === streakThreshold) {
            const currencyService = new CurrencyService(app);
            const targetCurrency = user.preferredCurrency || 'PEN';
            
            // Evaluamos el límite usando la conversión a la moneda nativa
            let allUnderLimit = true;
            let streakTotal = 0;
            for (const e of lastExpenses) {
                const amt = await getAmountNative(e as any, targetCurrency, currencyService);
                if (amt >= limit) {
                    allUnderLimit = false;
                    break;
                }
                streakTotal += amt;
            }

            if (allUnderLimit) {
                 const streakMsg = `🔥 Alerta de Racha: Llevas ${streakThreshold} gastos hormiga seguidos (Total: ${targetCurrency} ${streakTotal.toFixed(2)}).`;
                 alertMessage = alertMessage ? `${alertMessage}\n\n${streakMsg}` : streakMsg;
            }
        }
    }

    // Default "Smart" Alert (Legacy logic: >5 in 7 days) - Only if no custom alerts triggered
    if (!alertMessage && !streakThreshold && !countThreshold) {
         const sevenDaysAgo = new Date(now);
         sevenDaysAgo.setDate(now.getDate() - 7);
         const whereRecent = {
            userId: user.id,
            profileId,
            issuedAt: { gte: sevenDaysAgo },
            OR: [
                { amountNative: { not: null, lt: limit } },
                { amountNative: null, amount: { lt: limit } }
            ]
         };
         
         const recentSmall = await app.prisma.expense.findMany({
            where: whereRecent,
            select: { amount: true, amountNative: true }
         });
         
         if (recentSmall.length > 5) {
             const total = recentSmall.reduce((sum, e) => sum + (e.amountNative ?? e.amount), 0);
             alertMessage = `He detectado ${recentSmall.length} gastos hormiga (< ${limit}) en los últimos 7 días, sumando ${total.toFixed(2)}.`;
         }
    }

    return alertMessage;
}

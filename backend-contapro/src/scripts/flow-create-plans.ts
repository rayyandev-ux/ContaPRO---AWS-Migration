import { config } from '../config.js';
import axios from 'axios';
import crypto from 'crypto';
import qs from 'qs';

const isProd = process.env.FLOW_MODE === 'production';
const apiKey = isProd ? process.env.FLOW_API_KEY_PROD : process.env.FLOW_API_KEY_DEV;
const secretKey = isProd ? process.env.FLOW_SECRET_KEY_PROD : process.env.FLOW_SECRET_KEY_DEV;
const baseUrl = isProd ? 'https://www.flow.cl/api' : 'https://sandbox.flow.cl/api';

if (!apiKey || !secretKey) {
  console.error('Faltan las credenciales de Flow (FLOW_API_KEY_DEV / FLOW_SECRET_KEY_DEV)');
  process.exit(1);
}

const flowSign = (params: Record<string, any>): string => {
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = sortedKeys.map(key => `${key}${params[key]}`).join('');
  return crypto
    .createHmac('sha256', secretKey)
    .update(stringToSign)
    .digest('hex');
};

const createPlan = async (plan: any) => {
  const params: any = {
    apiKey,
    planId: plan.planId,
    name: plan.name,
    amount: plan.amount,
    currency: plan.currency,
    interval: plan.interval,
    urlCallback: plan.urlCallback,
    charges_retries_number: plan.charges_retries_number,
  };
  
  if (plan.trial_period_days) {
    params.trial_period_days = plan.trial_period_days;
  }

  params.s = flowSign(params);

  try {
    const res = await axios.post(`${baseUrl}/plan/create`, qs.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(`✅ Plan creado: ${plan.planId}`);
    return res.data;
  } catch (error: any) {
    if (error.response?.data?.code === 201) {
      console.log(`⚠️  Plan ya existe: ${plan.planId}`);
    } else {
      console.error(`❌ Error creando ${plan.planId}:`, error.response?.data || error.message);
    }
  }
};

const run = async () => {
  console.log(`--- Creando Planes en Flow (${isProd ? 'PRODUCCIÓN' : 'SANDBOX'}) ---`);
  
  const urlCallback = `${config.backendPublicUrl}/api/flow/callback/plan`;
  const suffix = isProd ? '' : 'Dev';

  const plans = [
    {
      planId: `ContaProMensual${suffix}`,
      name: 'ContaPRO Plan Mensual',
      amount: 18,
      interval: 3, // 3 = Mensual
      currency: 'PEN',
      trial_period_days: 7,
      urlCallback,
      charges_retries_number: 3,
    },
    {
      planId: `ContaProAnual${suffix}`,
      name: 'ContaPRO Plan Anual',
      amount: 120,
      interval: 4, // 4 = Anual
      currency: 'PEN',
      trial_period_days: 0,
      urlCallback,
      charges_retries_number: 3,
    },
    {
      planId: `ExtraPerfilMensual${suffix}`,
      name: 'Perfil Extra Mensual',
      amount: 9,
      interval: 3,
      currency: 'PEN',
      trial_period_days: 0,
      urlCallback,
      charges_retries_number: 3,
    },
    {
      planId: `ExtraPerfilAnual${suffix}`,
      name: 'Perfil Extra Anual',
      amount: 54,
      interval: 4,
      currency: 'PEN',
      trial_period_days: 0,
      urlCallback,
      charges_retries_number: 3,
    },
    {
      planId: `ExtraEmailMensual${suffix}`,
      name: 'Email Extra Mensual',
      amount: 5,
      interval: 3,
      currency: 'PEN',
      trial_period_days: 0,
      urlCallback,
      charges_retries_number: 3,
    },
    {
      planId: `ExtraEmailAnual${suffix}`,
      name: 'Email Extra Anual',
      amount: 50,
      interval: 4,
      currency: 'PEN',
      trial_period_days: 0,
      urlCallback,
      charges_retries_number: 3,
    }
  ];

  for (const plan of plans) {
    await createPlan(plan);
  }

  console.log('\n✅ Copia estos IDs en tu archivo .env:');
  console.log(`FLOW_PLAN_MONTHLY_ID_${isProd ? 'PROD' : 'DEV'}=ContaProMensual${suffix}`);
  console.log(`FLOW_PLAN_ANNUAL_ID_${isProd ? 'PROD' : 'DEV'}=ContaProAnual${suffix}`);
  console.log(`FLOW_PLAN_EXTRA_PROFILE_MONTHLY_ID_${isProd ? 'PROD' : 'DEV'}=ExtraPerfilMensual${suffix}`);
  console.log(`FLOW_PLAN_EXTRA_PROFILE_ANNUAL_ID_${isProd ? 'PROD' : 'DEV'}=ExtraPerfilAnual${suffix}`);
  console.log(`FLOW_PLAN_EXTRA_EMAIL_MONTHLY_ID_${isProd ? 'PROD' : 'DEV'}=ExtraEmailMensual${suffix}`);
  console.log(`FLOW_PLAN_EXTRA_EMAIL_ANNUAL_ID_${isProd ? 'PROD' : 'DEV'}=ExtraEmailAnual${suffix}`);
};

run();
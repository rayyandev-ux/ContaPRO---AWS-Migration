import Stripe from 'stripe';
import { config } from '../config.js';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});

export const getStripePriceId = (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'QUARTERLY'): string => {
  switch (plan) {
    case 'MONTHLY': return config.stripeMonthlyPriceId;
    case 'QUARTERLY': return config.stripeQuarterlyPriceId;
    case 'ANNUAL': return config.stripeAnnualPriceId;
    case 'LIFETIME': return config.stripeLifetimePriceId;
    default: return '';
  }
};

export const getExtraProfilePriceId = (interval: 'month' | 'year'): string => {
  switch (interval) {
    case 'month': return config.stripeExtraProfileMonthlyPriceId;
    case 'year': return config.stripeExtraProfileAnnualPriceId;
    default: return '';
  }
};

export const getExtraEmailPriceId = (interval: 'month' | 'year' = 'month'): string => {
  switch (interval) {
    case 'month': return config.stripeExtraEmailMonthlyPriceId;
    case 'year': return config.stripeExtraEmailAnnualPriceId;
    default: return '';
  }
};


export const isPremium = (user: any): boolean => {
  if (!user) return false;
  const now = new Date();
  
  // 1. Check Lifetime
  if (user.plan === 'LIFETIME') return true;

  // 2. Check Premium with Expiration
  if (user.plan === 'PREMIUM' && user.planExpires && new Date(user.planExpires) > now) return true;

  // 3. Check Stripe Subscription (Fallback for migrated users or missing webhook updates)
  if (user.stripeSubscriptionId) return true;

  // 4. Check Flow Subscription
  if (user.flowSubscriptionId && user.planExpires && new Date(user.planExpires) > now) return true;

  return false;
};

export const isTrial = (user: any): boolean => {
  if (!user) return false;
  const now = new Date();
  return user.trialEnds && new Date(user.trialEnds) > now;
};

export const isEntitled = (user: any): boolean => {
  if (!user) return false;
  return true;
};

export const activateSubscription = async (app: any, userId: string, plan: string, expires: Date | null, providerData: any) => {
  await app.prisma.user.update({
    where: { id: userId },
    data: {
      plan: plan === 'LIFETIME' ? 'LIFETIME' : 'PREMIUM',
      planExpires: expires,
      hasUsedTrial: true,
      ...providerData
    }
  });
};

export const handleAddonPurchase = async (app: any, userId: string, addon: 'EXTRA_PROFILE' | 'EXTRA_EMAIL') => {
  if (addon === 'EXTRA_PROFILE') {
    await app.prisma.user.update({
      where: { id: userId },
      data: { extraProfileSlots: { increment: 1 } }
    });
  } else if (addon === 'EXTRA_EMAIL') {
    await app.prisma.user.update({
      where: { id: userId },
      data: { extraEmailSlots: { increment: 1 } }
    });
  }
};

export const downgradeToFree = async (app: any, userId: string, providerData: any = {}) => {
  await app.prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'FREE',
      ...providerData
    }
  });
};

export const publishSseEvent = async (app: any, userId: string, type: string) => {
  try {
    const { publishEvent } = await import('../services/realtime.js');
    await publishEvent(userId, { type });
  } catch (e) {
    app.log.error(e, 'Error publishing realtime event');
  }
};

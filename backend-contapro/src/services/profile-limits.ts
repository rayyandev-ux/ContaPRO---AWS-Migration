import { PrismaClient } from '@prisma/client';
import { stripe } from './stripe.js';
import { config } from '../config.js';

export type ProfileLimits = {
  current: number;
  max: number;
  remaining: number;
  canCreate: boolean;
  baseLimit: number;
  extraProfiles: number;
  planInterval?: 'month' | 'year' | 'quarter';
};

export async function calculateProfileLimits(
  userId: string, 
  prisma: PrismaClient, 
  preFetchedUser?: { plan: any; stripeCustomerId: string | null; extraProfileSlots: number }
): Promise<ProfileLimits> {
  const user = preFetchedUser || await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true, stripeCustomerId: true, extraProfileSlots: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  let baseLimit = 1;
  // Note: ANNUAL is not in Plan enum, so we assume PREMIUM limit.
  // If we need to distinguish ANNUAL, we should update the Plan enum or check subscription.
  // if (user.plan === 'ANNUAL') baseLimit = 2; 
  if (user.plan === 'LIFETIME') baseLimit = 3;
  if (user.plan === 'BUSINESS') baseLimit = 5;

  let extraProfiles = 0;
  let planInterval: 'month' | 'year' | 'quarter' | undefined;

  if (user.plan === 'QUARTERLY') planInterval = 'quarter';

  // 1. Extra slots from DB (Lifetime purchases or manual grants)
  if (user.extraProfileSlots) {
    extraProfiles += user.extraProfileSlots;
  }

  const totalLimit = baseLimit + extraProfiles;
  
  const currentCount = await prisma.profile.count({
    where: { userId }
  });

  return {
    current: currentCount,
    max: totalLimit,
    remaining: Math.max(0, totalLimit - currentCount),
    canCreate: currentCount < totalLimit,
    baseLimit,
    extraProfiles,
    planInterval
  };
}

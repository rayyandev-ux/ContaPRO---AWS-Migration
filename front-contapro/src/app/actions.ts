'use server';

import { updateTag, revalidatePath } from 'next/cache';

export async function revalidateBudget() {
  updateTag('budget-current');
  updateTag('budget-month');
  updateTag('dashboard-stats-category');
  updateTag('dashboard-stats-month');
  updateTag('dashboard-budget-month');
}

export async function revalidateDashboard() {
  revalidatePath('/dashboard', 'page');
}

export async function revalidateEverything() {
  revalidatePath('/', 'layout');
}

export async function revalidateBudget() {
  // En modo estático (SPA), la invalidación de caché del servidor no aplica.
  // Utiliza router.refresh() en tus Client Components en su lugar.
}

export async function revalidateDashboard() {
  // No-op
}

export async function revalidateEverything() {
  // No-op
}

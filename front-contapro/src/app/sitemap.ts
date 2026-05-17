import { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_HOST 
    ? `https://${process.env.NEXT_PUBLIC_APP_HOST}` 
    : 'https://contapro.lat';

  // Páginas públicas que queremos indexar
  const routes = [
    '',
    '/pricing',
    '/contact',
    '/login',
    '/register',
    '/privacy-policy',
    '/terms-of-service',
    '/refund-returns',
    '/cookies',
  ];

  const sitemap: MetadataRoute.Sitemap = [];

  routes.forEach((route) => {
    routing.locales.forEach((locale) => {
      sitemap.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : 0.8,
      });
    });
  });

  return sitemap;
}

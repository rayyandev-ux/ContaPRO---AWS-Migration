import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_HOST 
    ? `https://${process.env.NEXT_PUBLIC_APP_HOST}` 
    : 'https://contapro.lat';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/account/',
        '/billing/',
        '/verify/',
        '/reset/',
        '/api/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

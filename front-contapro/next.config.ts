import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // 'export' genera un sitio 100% estático en /out (HTML+JS+CSS),
  // que se sube a S3 y se sirve por CloudFront. No hay servidor Node.
  // NOTA: por esto NO puede existir src/middleware.ts ni rutas /api.
  output: 'export',
  reactCompiler: true,
  images: {
    // El optimizador de imágenes de Next requiere un servidor; en estático
    // las imágenes se sirven tal cual desde S3/CloudFront.
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);

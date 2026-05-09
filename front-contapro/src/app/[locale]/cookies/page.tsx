import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { Metadata } from 'next';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Política de Cookies',
    alternates: {
      canonical: `/${locale}/cookies`,
      languages: {
        'es': '/es/cookies',
        'en': '/en/cookies',
        'pt': '/pt/cookies',
      },
    },
  };
}

export default function CookiesPage() {
  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      <SiteHeader />
      <div className="w-full bg-black py-12 pt-28">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="font-baskerville text-4xl sm:text-5xl font-bold tracking-tight text-center">Política de Cookies</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">Última actualización: 24 de noviembre de 2025</p>
          <div className="mt-10 mx-auto max-w-3xl space-y-8">
            <h2 className="text-xl font-semibold">Qué son las cookies</h2>
            <p className="text-sm text-muted-foreground">Pequeños archivos que se almacenan en tu dispositivo para recordar preferencias y mejorar el uso del sitio.</p>
            <h2 className="text-xl font-semibold">Tipos de cookies</h2>
            <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-2">
              <li>Esenciales: necesarias para el funcionamiento del sitio.</li>
              <li>Rendimiento: miden uso y ayudan a mejorar la experiencia.</li>
              <li>Analíticas: permiten entender cómo se utiliza el Servicio.</li>
            </ul>
            <h2 className="text-xl font-semibold">Gestión de preferencias</h2>
            <p className="text-sm text-muted-foreground">Puedes configurar tu navegador para aceptar, rechazar o borrar cookies según tus preferencias.</p>
            <h2 className="text-xl font-semibold">Cookies de terceros</h2>
            <p className="text-sm text-muted-foreground">Algunas cookies pueden ser de proveedores externos que nos ayudan a operar y mejorar el Servicio.</p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </section>
  );
}
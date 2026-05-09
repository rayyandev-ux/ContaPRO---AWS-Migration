import ContactContent from './ContactContent';
import type { Metadata } from 'next';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Contacto',
    alternates: {
      canonical: `/${locale}/contact`,
      languages: {
        'es': '/es/contact',
        'en': '/en/contact',
        'pt': '/pt/contact',
      },
    },
  };
}

export default function ContactPage() {
  return <ContactContent />;
}

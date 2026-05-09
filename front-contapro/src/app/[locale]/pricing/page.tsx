import PricingContent from './PricingContent';
import type { Metadata } from 'next';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Planes y Precios',
    alternates: {
      canonical: `/${locale}/pricing`,
      languages: {
        'es': '/es/pricing',
        'en': '/en/pricing',
        'pt': '/pt/pricing',
      },
    },
  };
}

export default function PricingPage() {
  return <PricingContent />;
}

import { Metadata } from 'next';
import PricingContent from './PricingContent';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: 'Precios',
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

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

import RegisterContent from "./RegisterContent";
import { Metadata } from 'next';

export const dynamic = "force-static";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Crear Cuenta',
    alternates: {
      canonical: `/${locale}/register`,
      languages: {
        'es': '/es/register',
        'en': '/en/register',
        'pt': '/pt/register',
      },
    },
  };
}

export default function RegisterPage() {
  return <RegisterContent />;
}
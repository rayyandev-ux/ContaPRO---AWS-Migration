import LoginContent from "./LoginContent";
import { Metadata } from 'next';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Iniciar Sesión',
    alternates: {
      canonical: `/${locale}/login`,
      languages: {
        'es': '/es/login',
        'en': '/en/login',
        'pt': '/pt/login',
      },
    },
  };
}

export default function LoginPage() {
  return <LoginContent />;
}
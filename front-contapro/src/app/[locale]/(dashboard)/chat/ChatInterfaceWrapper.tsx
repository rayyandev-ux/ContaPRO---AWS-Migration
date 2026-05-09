"use client";

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

const ChatInterface = dynamic(() => import('./ChatInterface'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-white/60">Cargando chat...</div>,
});

export default function ChatInterfaceWrapper() {
  return <ChatInterface />;
}

import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import ChatInterfaceWrapper from './ChatInterfaceWrapper';

export default async function ChatPage() {
  const t = await getTranslations('Chat');

  return (
    <div className="flex flex-col lg:flex-row h-full w-full max-w-[1400px] mx-auto overflow-hidden relative items-stretch px-4 sm:px-6 lg:px-8 pb-4 lg:pb-6 gap-6 lg:gap-16">
      
      {/* Custom Styles for Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes float-avatar {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          .animate-float {
            animation: float-avatar 6s ease-in-out infinite;
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.5s ease-out forwards;
          }
        `
      }} />

      {/* Left side: Floating Logo/Avatar */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center animate-float">
        <div className="relative w-72 h-72 xl:w-96 xl:h-96 flex items-center justify-center">
          <Image
            src="/pricing-plan-icon.png"
            alt="ContaPRO Logo"
            fill
            className="object-contain drop-shadow-[0_0_50px_rgba(139,92,246,0.5)]"
            priority
          />
        </div>
      </div>

      {/* Right side: Chat Window */}
      <div className="flex-1 w-full max-w-xl lg:max-w-2xl h-full flex flex-col z-10 animate-slide-up">
        {/* Mobile Header (hidden on large screens where avatar is shown) */}
        <div className="lg:hidden mt-2 mb-4 shrink-0 flex flex-col items-center text-center">
          <div className="relative w-12 h-12 mb-2 flex items-center justify-center animate-float">
            <Image
              src="/pricing-plan-icon.png"
              alt="ContaPRO Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.4)]"
            />
          </div>
          <h1 className="text-2xl font-playfair font-bold text-white tracking-tight">{t('title')}</h1>
          <p className="text-white/50 text-xs font-medium uppercase tracking-widest mt-1">{t('subtitle')}</p>
        </div>

        <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col relative min-h-0">
          <ChatInterfaceWrapper />
        </div>
      </div>
    </div>
  );
}

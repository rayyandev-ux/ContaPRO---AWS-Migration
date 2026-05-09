import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import FaultyTerminalBackground from '@/components/FaultyTerminal';
import { cn } from '@/lib/utils';
import { Metadata } from 'next';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Refund Policy',
    alternates: {
      canonical: `/${locale}/refund-returns`,
      languages: {
        'es': '/es/refund-returns',
        'en': '/en/refund-returns',
        'pt': '/pt/refund-returns',
      },
    },
  };
}

export default function RefundReturnsPage() {
  return (
    <section className="relative min-h-svh w-full overflow-hidden bg-[#050505] text-foreground">
      <SiteHeader />
      
      {/* Background Ambience */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40">
        <FaultyTerminalBackground 
          tint="#4c1d95" 
          gridMul={[2, 2]} 
          brightness={0.6}
          scanlineIntensity={0.2}
          flickerAmount={0.05}
          glitchAmount={0.5}
        />
      </div>
      
      <div className="relative z-10 w-full pt-32 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16 relative">
            <h1 className="font-baskerville text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-purple-400 drop-shadow-[0_0_25px_rgba(168,85,247,0.4)]">
              Refund and Return Policy
            </h1>
            <p className="mt-4 text-purple-200/60 font-medium tracking-widest text-sm uppercase">
              Last update: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className={cn(
            "rounded-[2rem] border transition-all duration-500 relative overflow-hidden p-8 md:p-12 mx-auto max-w-4xl",
            "backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
            "bg-gradient-to-b from-white/5 to-white/0 border-white/10"
          )}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />
            
            <div className="space-y-8 text-sm md:text-base text-gray-300 leading-relaxed font-light tracking-wide">
              <p>
                At ContaPRO, our commitment is to provide a high-quality service that meets the management needs of our clients. Below is our refund and return policy:
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">1. Subscription Model</h2>
              <p>
                ContaPRO operates under a subscription model that offers monthly and annual options. Once a subscription is purchased, full access to the software and its features is granted, which means that all sales are final.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">2. Refunds</h2>
              <p>
                We do not offer refunds for subscription cancellations, whether monthly or annual, after the customer has accessed the service, with the following exceptions:
              </p>
              <p className="pl-4 border-l-2 border-purple-500/30">
                <strong className="text-purple-300">Credit card fraud:</strong> If it is proven that a purchase was made using a stolen card or without the authorization of the legitimate owner, the corresponding refund will be issued. In this case, the user must contact our support team as soon as possible to initiate the validation process.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">3. Refund Procedure</h2>
              <p>
                In the case of a fraudulent or unauthorized purchase, once the claim is validated, the refund will be issued within 15 business days. The refund will be processed through the original payment method used for the purchase.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">4. Cancellations</h2>
              <p>
                Users may cancel their subscription at any time. However, cancellation will not result in any refund for the unused time of the subscription period, and access to the service will continue until the end of the current billing cycle.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">5. Contact</h2>
              <p>
                If you have any questions about this policy or wish to initiate a claim related to a fraudulent purchase, you can contact us through our support team at <a href="mailto:support@contapro.lat" className="text-purple-400 hover:text-purple-300 transition-colors underline decoration-purple-500/30 hover:decoration-purple-400">support@contapro.lat</a>.
              </p>
            </div>
          </div>
        </div>
        
        {/* Neon Convex Curve Separator */}
        <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-none z-20">
          <svg
            className="relative block w-full h-[60px] md:h-[100px]"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0 Q600,240 1200,0 L1200,120 L0,120 Z"
              className="fill-black"
            ></path>
            <path
              d="M0,0 Q600,240 1200,0"
              fill="none"
              stroke="url(#refund-curve-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]"
            ></path>
            <defs>
              <linearGradient id="refund-curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
                <stop offset="20%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="80%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <SiteFooter />
    </section>
  );
}

import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { Link } from '@/i18n/routing';
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
    title: 'Terms of Service',
    alternates: {
      canonical: `/${locale}/terms-of-service`,
      languages: {
        'es': '/es/terms-of-service',
        'en': '/en/terms-of-service',
        'pt': '/pt/terms-of-service',
      },
    },
  };
}

export default function TermsOfServicePage() {
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

      <div className="w-full py-12 pt-32 pb-24 relative z-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-16">
            <h1 className="font-baskerville text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-300 to-white">
                Terms and Conditions of Use
              </span>
            </h1>
            <p className="text-sm text-zinc-400 font-mono">Last update: {new Date().toLocaleDateString()}</p>
          </div>

          <div className={cn(
            "rounded-[2rem] border transition-all duration-500 relative overflow-hidden p-8 md:p-12",
            "backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
            "bg-gradient-to-b from-white/5 to-white/0 border-white/10"
          )}>
            {/* Liquid Glass Highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />

            <div className="space-y-12 text-zinc-300 leading-relaxed relative z-10">
              
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">1</span>
                  Terms
                </h2>
                <p>
                  By accessing the website at <Link href="/" className="text-violet-400 hover:text-violet-300 underline underline-offset-4 decoration-violet-500/30 transition-colors">ContaPRO</Link> you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site. The materials contained in this website are protected by applicable copyright and trademark law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">2</span>
                  Use License
                </h2>
                <p className="mb-4">
                  Permission is granted to temporarily download one copy of the materials (information or software) on ContaPRO’s website for personal, non-commercial transitory viewing only. This is the grant of a licence, not a transfer of title, and under this licence you may not:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-400 marker:text-violet-500">
                  <li>modify or copy the materials;</li>
                  <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
                  <li>attempt to decompile or reverse engineer any software contained on ContaPRO website;</li>
                  <li>remove any copyright or other proprietary notations from the materials; or</li>
                  <li>transfer the materials to another person or ‘mirror’ the materials on any other server.</li>
                </ul>
                <p className="mt-4">
                  This licence shall automatically terminate if you violate any of these restrictions and may be terminated by ContaPRO at any time. Upon terminating your viewing of these materials or upon the termination of this licence, you must destroy any downloaded materials in your possession whether in electronic or printed format.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">3</span>
                  Disclaimer
                </h2>
                <p className="mb-4">
                  The materials on ContaPRO’s website are provided on an ‘as is’ basis. ContaPRO makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                </p>
                <p>
                  Further, ContaPRO does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its website or otherwise relating to such materials or on any sites linked to this site.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">4</span>
                  Limitations
                </h2>
                <p>
                  In no event shall ContaPRO or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on ContaPRO’s website, even if ContaPRO or a ContaPRO authorised representative has been notified orally or in writing of the possibility of such damage. Because some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, these limitations may not apply to you.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">5</span>
                  Accuracy of materials
                </h2>
                <p>
                  The materials appearing on ContaPRO’s website could include technical, typographical, or photographic errors. ContaPRO does not warrant that any of the materials on its website are accurate, complete or current. ContaPRO may make changes to the materials contained on its website at any time without notice. However ContaPRO does not make any commitment to update the materials.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">6</span>
                  Links
                </h2>
                <p>
                  ContaPRO has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by ContaPRO of the site. Use of any such linked website is at the user’s own risk.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">7</span>
                  Modifications
                </h2>
                <p>
                  ContaPRO may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold border border-violet-500/30">8</span>
                  Governing Law
                </h2>
                <p>
                  These terms and conditions are governed by and construed in accordance with the laws of ContaPRO and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
                </p>
              </section>
            </div>
          </div>
        </div>
        
        {/* Convex Curve Separator with Neon Effect */}
        <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-none z-20">
          <svg
            className="relative block w-full h-[60px] md:h-[100px]"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            {/* Masking Shape (Black Corners) */}
            <path
              d="M0,0 Q600,240 1200,0 L1200,120 L0,120 Z"
              className="fill-black"
            ></path>
            
            {/* Neon Line Stroke */}
            <path
              d="M0,0 Q600,240 1200,0"
              fill="none"
              stroke="url(#terms-curve-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]"
            ></path>

            <defs>
              <linearGradient id="terms-curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
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
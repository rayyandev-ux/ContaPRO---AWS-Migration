import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import FaultyTerminalBackground from '@/components/FaultyTerminal';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Metadata } from 'next';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Privacy Policy',
    alternates: {
      canonical: `/${locale}/privacy-policy`,
      languages: {
        'es': '/es/privacy-policy',
        'en': '/en/privacy-policy',
        'pt': '/pt/privacy-policy',
      },
    },
  };
}

export default function PrivacyPolicyPage() {
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
              Privacy Policy
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
                Your privacy is important to us. It is ContaPRO’s policy to respect your privacy regarding any information we may collect from you across our website, <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors underline decoration-purple-500/30 hover:decoration-purple-400">ContaPRO</Link>, and other sites we own and operate.
              </p>
              <p>
                We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.
              </p>
              <p>
                We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we’ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorised access, disclosure, copying, use or modification.
              </p>
              <p>
                We don’t share any personally identifying information publicly or with third-parties, except when required to by law.
              </p>
              <p>
                Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites, and cannot accept responsibility or liability for their respective privacy policies.
              </p>
              <p>
                You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services.
              </p>
              <p>
                Your continued use of our website will be regarded as acceptance of our practices around privacy and personal information. If you have any questions about how we handle user data and personal information, feel free to contact us.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Cookie Policy for ContaPRO</h2>
              <p>
                This is the Cookie Policy for ContaPRO, accessible from URL <Link href="https://contapro.lat" className="text-purple-400 hover:text-purple-300 transition-colors underline decoration-purple-500/30 hover:decoration-purple-400">https://contapro.lat</Link>.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">What Are Cookies</h2>
              <p>
                As is common practice with almost all professional websites this site uses cookies, which are tiny files that are downloaded to your computer, to improve your experience. This page describes what information they gather, how we use it and why we sometimes need to store these cookies. We will also share how you can prevent these cookies from being stored however this may downgrade or break certain elements of the sites functionality.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">How We Use Cookies</h2>
              <p>
                We use cookies for a variety of reasons detailed below. Unfortunately in most cases there are no industry standard options for disabling cookies without completely disabling the functionality and features they add to this site. It is recommended that you leave on all cookies if you are not sure whether you need them or not in case they are used to provide a service that you use.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Disabling Cookies</h2>
              <p>
                You can prevent the setting of cookies by adjusting the settings on your browser (see your browser Help for how to do this). Be aware that disabling cookies will affect the functionality of this and many other websites that you visit. Disabling cookies will usually result in also disabling certain functionality and features of this site. Therefore it is recommended that you do not disable cookies.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">The Cookies We Set</h2>
              
              <h3 className="text-xl font-medium text-purple-200 mt-8 mb-4">Third Party Cookies</h3>
              <p>
                In some special cases we also use cookies provided by trusted third parties. The following section details which third party cookies you might encounter through this site.
              </p>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">User’s responsibilities</h2>
              <p>
                The user undertakes the responsibility to make appropriate use of the contents and information offered on the site with enunciative, but not imitative, behaviour:
              </p>
              <ul className="list-disc pl-6 space-y-3 marker:text-purple-500">
                <li>Not to engage in activities that are illegal or contrary to good faith and public order;</li>
                <li>Not to spread propaganda or content of a racist, xenophobic or gambling nature, any type of illegal pornography, terrorist claims or against human rights;</li>
                <li>Do not cause damage to physical systems (hardware) and unattainable (software) of ContaPRO, its suppliers or third parties, to introduce or disseminate computer viruses or any other hardware or software systems that are capable of causing damage previously mentioned.</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mt-12 mb-6">More information</h2>
              <p>
                Hopefully that has clarified things for you and as was previously mentioned if there is something that you aren’t sure whether you need or not it’s usually safer to leave cookies enabled in case it does interact with one of the features you use on our site.
              </p>
              
              <p className="pt-8 text-xs text-purple-300/50 border-t border-white/10 mt-12">
                This policy is effective as of 1 May 2025 18:33.
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
              stroke="url(#privacy-curve-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]"
            ></path>
            <defs>
              <linearGradient id="privacy-curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
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

'use client';

import { useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MapPin, Loader2, Send } from 'lucide-react';
import { COUNTRY_CODES } from '@/lib/country-codes';
import FaultyTerminalBackground from '@/components/FaultyTerminal';
import { PricingSparkles } from '@/components/PricingSparkles';
import { cn } from '@/lib/utils';
import GlassCombobox from '@/components/ui/glass-combobox';

export default function ContactContent() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = {
      subject: formData.get('subject'),
      name: formData.get('name'),
      countryCode: formData.get('countryCode'),
      whatsapp: formData.get('whatsapp'),
      email: formData.get('email'),
      message: formData.get('message'),
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Algo salió mal');
      }

      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err.message || 'Error al enviar el mensaje');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            
            {/* Left Column: Info */}
            <div className="space-y-8 mt-4">
              <h1 className="font-baskerville text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                PONTE EN CONTACTO CON <br/>
                <span className="text-muted-foreground">EL EQUIPO DE </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">CONTAPRO</span>
              </h1>
              
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Empieza por seleccionar la naturaleza de tu consulta y rellena el siguiente formulario. 
                Nuestros especialistas se pondrán en contacto contigo en un plazo de 48 horas.
              </p>
              
              <div className="pt-8 space-y-4 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground text-base">Neopatron Ltd. dba Contapro</div>
                <div className="flex items-start gap-3">
                   <div className="p-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
                     <MapPin className="w-5 h-5 shrink-0" />
                   </div>
                   <span className="mt-1.5">Unit 82a James Carter Road Mildenhall, Bury St. Edmunds England, IP28 7DE</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      <Mail className="w-5 h-5 shrink-0" />
                    </div>
                    <a href="mailto:support@contapro.lat" className="hover:text-white transition-colors mt-0.5">support@contapro.lat</a>
                </div>
              </div>
            </div>

            {/* Right Column: Form */}
            <div className={cn(
                "rounded-[2rem] border transition-all duration-500 relative overflow-hidden p-6 sm:p-8",
                "backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
                "bg-gradient-to-b from-white/5 to-white/0 border-white/10 hover:bg-white/10 hover:border-white/20"
            )}>
               {/* Liquid Glass Highlight */}
               <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
               <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />
               
               {/* Decorative gradient blob inside card */}
               <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

               <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                 <div className="space-y-2">
                    <Label htmlFor="subject" className="text-zinc-300">Asunto</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {['Soporte', 'Ventas', 'Pagos', 'Otro'].map((option) => (
                            <div key={option} className="flex items-center">
                                <input 
                                    type="radio" 
                                    id={`subject-${option}`} 
                                    name="subject" 
                                    value={option} 
                                    className="peer sr-only" 
                                    defaultChecked={option === 'Soporte'}
                                />
                                <label 
                                    htmlFor={`subject-${option}`}
                                    className="w-full text-center px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-zinc-400 cursor-pointer transition-all hover:bg-white/10 peer-checked:bg-violet-600/20 peer-checked:border-violet-500/50 peer-checked:text-white"
                                >
                                    {option}
                                </label>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-zinc-300">Nombre completo</Label>
                        <Input 
                            id="name" 
                            name="name" 
                            placeholder="John Doe" 
                            required 
                            className="bg-black/20 border-white/10 focus:border-violet-500/50 text-white placeholder:text-zinc-600 h-10"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-300">Email</Label>
                        <Input 
                            id="email" 
                            name="email" 
                            type="email" 
                            placeholder="john@example.com" 
                            required 
                            className="bg-black/20 border-white/10 focus:border-violet-500/50 text-white placeholder:text-zinc-600 h-10"
                        />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-zinc-300">WhatsApp (Opcional)</Label>
                    <div className="flex gap-2">
                        <GlassCombobox
                            name="countryCode"
                            defaultValue="+51"
                            className="w-32 bg-black/20 border-white/10 focus:border-violet-500/50 rounded-md py-2 px-3 h-10 text-white hover:bg-black/40"
                            options={COUNTRY_CODES.map((country) => ({
                                value: country.dial,
                                label: `${country.flag} ${country.dial}`
                            }))}
                        />
                        <Input 
                            id="whatsapp" 
                            name="whatsapp" 
                            placeholder="999 999 999" 
                            className="bg-black/20 border-white/10 focus:border-violet-500/50 text-white placeholder:text-zinc-600 h-10 flex-1"
                        />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label htmlFor="message" className="text-zinc-300">Mensaje</Label>
                    <textarea 
                        id="message" 
                        name="message" 
                        rows={4} 
                        placeholder="¿En qué podemos ayudarte?" 
                        required
                        className="flex w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 min-h-[120px]"
                    ></textarea>
                 </div>

                 <Button 
                    type="submit" 
                    disabled={loading}
                    className={cn(
                      "w-full h-12 rounded-full text-base font-medium tracking-wide transition-all duration-300 overflow-visible group relative",
                      "bg-gradient-to-b from-white/30 to-white/10 backdrop-blur-xl border border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:bg-white/20 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)]"
                    )}
                 >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md" />
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                      <PricingSparkles color="text-white" />
                    </div>
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin relative z-10" />
                    ) : (
                        <Send className="mr-2 h-4 w-4 relative z-10" />
                    )}
                    <span className="relative z-10">{loading ? 'Enviando...' : 'Enviar mensaje'}</span>
                 </Button>

                 {success && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center animate-in fade-in slide-in-from-bottom-2">
                        Mensaje enviado correctamente. Nos pondremos en contacto pronto.
                    </div>
                 )}
                 
                 {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-in fade-in slide-in-from-bottom-2">
                        {error}
                    </div>
                 )}
               </form>
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
              stroke="url(#contact-curve-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]"
            ></path>

            <defs>
              <linearGradient id="contact-curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
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

"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import QRCode from "react-qr-code";

type Status = { ok: boolean; linked?: boolean; botUsername?: string; userHandle?: string; error?: string };
type LinkResp = { ok: boolean; deepLink?: string; code?: string; botUsername?: string; error?: string };

export default function TelegramLinkCard() {
  const [status, setStatus] = useState<Status>({ ok: false });
  const [link, setLink] = useState<LinkResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proxy/integrations/telegram/status", { credentials: "include" });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ ok: false, error: "No se pudo obtener estado" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  // Auto-actualiza estado tras generar el link
  useEffect(() => {
    if (!status.linked && link) {
      const iv = setInterval(() => { refresh(); }, 3000);
      const to = setTimeout(() => { clearInterval(iv); }, 120000);
      return () => { clearInterval(iv); clearTimeout(to); };
    }
  }, [link, status.linked]);

  async function generateLink() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proxy/integrations/telegram/link", { method: "POST", credentials: "include" });
      const data = await res.json();
      setLink(data);
    } catch {
      setMsg("No se pudo generar el enlace");
    } finally {
      setLoading(false);
    }
  }

  async function unlink() {
    setLoading(true);
    setMsg(null);
    try {
      await fetch("/api/proxy/integrations/telegram/unlink", { method: "POST", credentials: "include" });
      setLink(null);
      await refresh();
    } catch {
      setMsg("No se pudo desvincular");
    } finally {
      setLoading(false);
    }
  }

  async function testSend() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/proxy/integrations/telegram/test", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data?.ok) setMsg("Mensaje de prueba enviado"); else setMsg(data?.error || "Error al enviar");
    } catch {
      setMsg("No se pudo enviar el mensaje");
    } finally {
      setLoading(false);
    }
  }

  const username = link?.botUsername || status.botUsername;
  const userHandle = status.userHandle;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-2xl min-h-[460px] text-white">
      <div className="grid gap-3 md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_460px] items-center">
        <div>
        <div className="text-xl font-semibold">Conecta tu Telegram</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
            {status.ok && status.linked ? (
              <Button variant="outline" size="sm" className="gap-1 rounded-full border-zinc-500/40 bg-zinc-500/10 text-zinc-300">
                <CheckCircle2 className="h-4 w-4" />
                Telegram ya está conectado
              </Button>
            ) : (
              <Button onClick={generateLink} disabled={loading} size="sm">Vincular Telegram</Button>
            )}
            {status.linked && (
              <Button onClick={testSend} variant="panel" size="sm" disabled={loading}>Probar envío</Button>
            )}
            {status.linked && (
              <Button onClick={unlink} variant="destructive" size="sm" className="rounded-full shadow-none hover:shadow-none hover:translate-y-0 transition-none hover:bg-destructive" disabled={loading}>Desvincular</Button>
            )}
          </div>
        {status.linked && userHandle && (
          <div className="mt-2 text-sm">Vinculado a {userHandle}</div>
        )}
        <div className="mt-2 text-xs text-white/50">Solo puedes vincular una cuenta de telegram a tu ContaPRO.</div>

        {!status.linked && link?.deepLink && (
          <div className="mt-6 flex flex-col md:flex-row gap-6 items-start">
            <div className="bg-white p-3 rounded-2xl shadow-lg shrink-0">
              <QRCode 
                value={link.deepLink} 
                size={140} 
                fgColor="#000" 
                bgColor="#fff" 
                level="M"
              />
            </div>
            
            <div className="text-sm flex flex-col gap-4 w-full">
              <div>
                <div className="text-white/80 font-medium mb-2">Sigue estos pasos:</div>
                <ol className="space-y-2 list-decimal pl-5 text-white/70">
                  <li>Escanea el QR o haz clic en el botón de abajo para abrir Telegram.</li>
                  <li>
                    Se abrirá el bot con el código automáticamente. Si no, envía este mensaje: <br/>
                    <code className="inline-block mt-1 rounded-md bg-white/10 px-2 py-1 text-white font-mono text-base border border-white/20">/start {link.code}</code>
                  </li>
                  <li>Espera a que esta pantalla se actualice automáticamente.</li>
                </ol>
              </div>
              
              <div className="flex flex-wrap gap-3 mt-1">
                <a 
                    href={link.deepLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                  >
                    Ir a Telegram
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  
                  {/* Para que no de error el linter */}
                  <span className="sr-only">Bot: {username || 'Telegram Bot'}</span>
                
                <button 
                  onClick={refresh} 
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        )}

          {msg && <div className="mt-3 text-xs text-white/50">{msg}</div>}
          
        </div>
        <div className="flex items-center justify-center md:justify-end mt-4 md:mt-0">
          <Image src="/logo_telegram.png" alt="Telegram" width={640} height={480} className="w-[280px] md:w-[380px] lg:w-[460px] h-auto object-contain" />
        </div>
      </div>
    </div>
  );
}
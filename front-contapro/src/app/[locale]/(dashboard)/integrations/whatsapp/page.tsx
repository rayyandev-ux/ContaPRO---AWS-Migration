import WhatsAppLinkCard from "@/components/WhatsAppLinkCard";
import { MessageCircle } from "lucide-react";
import Image from "next/image";

export default async function WhatsAppIntegrationPage() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Integración: WhatsApp</h1>
        </div>
      </div>
      <div className="grid gap-4">
        <WhatsAppLinkCard />
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-white/50">Powered by</span>
          <a href="https://wazend.net/" target="_blank" rel="noreferrer" className="inline-flex items-center">
            <Image src="/sponsors/Logos-7.png" alt="Wazend" width={300} height={64} className="h-5 md:h-6 w-auto opacity-90 hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>
    </section>
  );
}
import WhatsAppLinkCard from "@/components/WhatsAppLinkCard";
import TelegramLinkCard from "@/components/TelegramLinkCard";
import GmailLinkCard from "@/components/GmailLinkCard";
import Image from "next/image";
 

export default async function IntegrationsPage() {
  return (
    <section id="integrations-page-container" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-playfair font-semibold">Integraciones</h1>
      </div>
      
      {/* Featured Integration: Gmail */}
      <div id="gmail-integration" className="w-full">
         <GmailLinkCard />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div id="whatsapp">
          <WhatsAppLinkCard />
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-xs text-white/50">Powered by</span>
            <a href="https://wazend.net/" target="_blank" rel="noreferrer" className="inline-flex items-center">
              <Image src="/sponsors/Logos-7.png" alt="Wazend" width={300} height={64} className="h-5 md:h-6 w-auto opacity-90 hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
        <div id="telegram">
          <TelegramLinkCard />
        </div>
      </div>
    </section>
  );
}
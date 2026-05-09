import TelegramLinkCard from "@/components/TelegramLinkCard";
import { Send } from "lucide-react";

export default async function TelegramIntegrationPage() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Integración: Telegram</h1>
        </div>
      </div>
      <div className="grid gap-4">
        <TelegramLinkCard />
      </div>
    </section>
  );
}
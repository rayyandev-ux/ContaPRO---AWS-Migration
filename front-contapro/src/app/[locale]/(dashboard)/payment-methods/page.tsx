"use client";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { Loader2 } from "lucide-react";
import PaymentMethodsClient from "./PaymentMethodsClient";

export default function Page() {
  const [items, setItems] = useState<any[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiJson("/api/payment-methods");
        if (res.ok && res.data) {
          setItems(res.data.items || []);
          setDefaultId(res.data.defaultPaymentMethodId || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <PaymentMethodsClient
      initialItems={items}
      initialDefaultId={defaultId}
    />
  );
}

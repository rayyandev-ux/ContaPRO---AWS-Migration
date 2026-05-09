'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearApiCache } from '@/lib/api';
import { revalidateEverything } from '@/app/actions';

export default function RealtimeRefresh() {
  const router = useRouter();
  useEffect(() => {
    let evtSource: EventSource | null = null;
    let bc: BroadcastChannel | null = null;

    if (typeof window !== 'undefined') {
      try { bc = new BroadcastChannel('contapro:mutated'); } catch {}
      bc?.addEventListener('message', (e) => {
        // Si otro tab hizo una mutación local, refrescamos Server Components
        if (e.data === 'updated' || e.data === 'deleted') {
          router.refresh();
        }
      });

      const onVis = () => { if (document.visibilityState === 'visible') router.refresh(); };
      document.addEventListener('visibilitychange', onVis);

      // Connect to SSE for true Realtime updates across devices
      evtSource = new EventSource('/api/proxy/stream');
      
      evtSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          // Si es una mutación o un evento de facturación/suscripción
          if (data.type === 'MUTATION' || data.type?.startsWith('payment_method:') || data.type?.startsWith('subscription:')) {
            clearApiCache();
            await revalidateEverything(); // Clear Next.js server cache
            bc?.postMessage('realtime_mutation'); // Tell client pages to reload
            router.refresh(); // Refresh Server Components
          }
        } catch (e) {}
      };

      evtSource.onerror = () => {
        evtSource?.close();
        // EventSource will automatically try to reconnect.
        // We close it and let the browser handle it if it fails, or manually re-init
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            router.refresh();
          }
        }, 5000);
      };
    }

    return () => {
      try { bc?.close(); } catch {}
      evtSource?.close();
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', () => {});
      }
    };
  }, [router]);
  return null;
}
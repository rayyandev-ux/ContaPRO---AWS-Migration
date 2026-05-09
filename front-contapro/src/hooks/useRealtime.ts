import { useEffect } from "react";
import { clearApiCache } from "@/lib/api";

export function useRealtime(callback: () => void) {
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    
    if (typeof window !== "undefined") {
      try {
        bc = new BroadcastChannel("contapro:mutated");
        bc.addEventListener("message", (e) => {
          if (e.data === "updated" || e.data === "deleted" || e.data === "realtime_mutation") {
            clearApiCache();
            callback();
          }
        });
      } catch (e) {
        console.error("BroadcastChannel not supported", e);
      }
    }

    return () => {
      try {
        bc?.close();
      } catch (e) {}
    };
  }, [callback]);
}

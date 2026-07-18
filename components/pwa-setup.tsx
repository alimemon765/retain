"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushOutbox } from "@/lib/outbox";

export function PwaSetup() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    async function flush() {
      try {
        const n = await flushOutbox();
        if (n > 0) router.refresh();
      } catch {
        // still offline or server unreachable — retry on next signal
      }
    }
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [router]);

  return null;
}

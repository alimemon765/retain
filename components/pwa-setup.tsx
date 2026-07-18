"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushOutbox } from "@/lib/outbox";

export function PwaSetup() {
  const router = useRouter();

  useEffect(() => {
    // Dev assets aren't content-hashed, so the SW's cache-first strategy for
    // /_next/static would serve stale files — register in production only.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
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

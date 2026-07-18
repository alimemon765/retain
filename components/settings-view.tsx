"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState =
  | "unsupported"
  | "denied"
  | "subscribed"
  | "unsubscribed"
  | "loading";

export function SettingsView({ vapidConfigured }: { vapidConfigured: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "unsubscribed");
    }
    void check();
  }, []);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("failed to store subscription");
      setState("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "subscription failed");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-edge bg-surface p-4">
        <div>
          <h2 className="font-medium">Daily reminder</h2>
          <p className="mt-1 text-sm text-muted">
            A push notification at 7:00 AM IST with the number of topics due.
          </p>
        </div>

        {!vapidConfigured && (
          <p className="text-sm text-again">
            Push is not configured — set the VAPID env vars on the server.
          </p>
        )}
        {state === "loading" && <p className="text-sm text-muted">Checking…</p>}
        {state === "unsupported" && (
          <p className="text-sm text-muted">
            This browser doesn&apos;t support push notifications.
          </p>
        )}
        {state === "denied" && (
          <p className="text-sm text-muted">
            Notifications are blocked — allow them for this site in your browser
            settings, then come back.
          </p>
        )}
        {state === "unsubscribed" && vapidConfigured && (
          <button
            type="button"
            onClick={subscribe}
            disabled={busy}
            className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
        )}
        {state === "subscribed" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-good">Enabled on this device</span>
            <button
              type="button"
              onClick={unsubscribe}
              disabled={busy}
              className="text-sm text-muted underline"
            >
              disable
            </button>
          </div>
        )}
        {error && <p className="text-sm text-again">{error}</p>}

        <p className="border-t border-edge pt-3 text-xs text-muted">
          iPhone/iPad: push only works after adding Retain to your home screen
          (Share → Add to Home Screen) and enabling notifications from the
          installed app.
        </p>
      </section>
    </div>
  );
}

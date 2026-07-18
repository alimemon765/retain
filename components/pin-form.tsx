"use client";

import { useState } from "react";
import { verifyPin } from "@/app/pin/actions";

export function PinForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyPin(pin);
      // On success verifyPin redirects and never returns.
      if (result?.error) {
        setError(result.error);
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-56 flex-col items-center gap-3">
      <input
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="PIN"
        className="w-full rounded-xl bg-surface px-4 py-3.5 text-center text-lg tracking-[0.5em] outline-none placeholder:tracking-normal placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={busy || !pin}
        className="w-full rounded-xl bg-accent py-3 font-medium text-background disabled:opacity-50"
      >
        {busy ? "…" : "Unlock"}
      </button>
      {error && <p className="text-sm text-again">{error}</p>}
    </form>
  );
}

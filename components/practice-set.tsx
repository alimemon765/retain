"use client";

import { useState } from "react";
import { getPracticeSet } from "@/app/dsa-actions";
import { DIFFICULTY_COLORS } from "@/lib/dsa";
import type { Difficulty } from "@/lib/types";

interface SetItem {
  id: string;
  title: string;
  url: string | null;
  difficulty: string;
  patterns: string[];
}

export function PracticeSetBuilder() {
  const [set, setSet] = useState<SetItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function build() {
    setBusy(true);
    try {
      setSet(await getPracticeSet());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Practice session
        </h2>
        <button
          type="button"
          onClick={build}
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Building…" : set ? "Rebuild" : "Build me a practice set"}
        </button>
      </div>

      {set === null ? (
        <p className="text-xs text-muted">
          5 problems, weighted toward your weakest patterns and overdue
          re-solves — deliberately mixed so you have to recognize the pattern.
        </p>
      ) : set.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          No problems available — log some from the Log screen first.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {set.map((p, i) => {
            const diffColor = DIFFICULTY_COLORS[p.difficulty as Difficulty];
            return (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
              >
                <span className="mt-0.5 text-xs font-semibold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium underline decoration-edge underline-offset-2"
                    >
                      {p.title}
                    </a>
                  ) : (
                    <span className="text-sm font-medium">{p.title}</span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${diffColor}22`, color: diffColor }}
                    >
                      {p.difficulty.charAt(0) + p.difficulty.slice(1).toLowerCase()}
                    </span>
                    {p.patterns.map((pat) => (
                      <span
                        key={pat}
                        className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted"
                      >
                        {pat}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { submitAttempt } from "@/app/dsa-actions";
import { enqueueAttempt } from "@/lib/outbox";
import { DIFFICULTY_COLORS } from "@/lib/dsa";
import type { ProblemCard } from "@/lib/queries-dsa";
import type { DsaOutcome } from "@/lib/types";

const OUTCOME_BUTTONS: { outcome: DsaOutcome; label: string; cls: string }[] = [
  { outcome: "SOLVED_CLEAN", label: "Clean", cls: "text-good border-good/40" },
  { outcome: "SOLVED_STRUGGLED", label: "Struggled", cls: "text-easy border-easy/40" },
  { outcome: "NEEDED_HINT", label: "Hint", cls: "text-hard border-hard/40" },
  { outcome: "LOOKED_UP_SOLUTION", label: "Looked up", cls: "text-again border-again/40" },
];

export function DsaToday({ initialProblems }: { initialProblems: ProblemCard[] }) {
  const [problems, setProblems] = useState(initialProblems);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  async function record(problem: ProblemCard, outcome: DsaOutcome) {
    setLeaving((s) => new Set(s).add(problem.id));
    const remove = () =>
      setTimeout(
        () => setProblems((ps) => ps.filter((p) => p.id !== problem.id)),
        350
      );
    try {
      const result = await submitAttempt(problem.id, outcome);
      setToast(
        `Next re-solve: ${result.intervalDays} ${result.intervalDays === 1 ? "day" : "days"}`
      );
      setTimeout(() => setToast(null), 2000);
      remove();
    } catch {
      try {
        await enqueueAttempt(problem.id, outcome);
        setToast("Offline — attempt queued");
        setTimeout(() => setToast(null), 2500);
        remove();
      } catch {
        setLeaving((s) => {
          const next = new Set(s);
          next.delete(problem.id);
          return next;
        });
        setToast("Failed to save — try again");
        setTimeout(() => setToast(null), 3000);
      }
    }
  }

  if (problems.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        DSA re-solves
      </h2>
      {problems.map((p) => (
        <ProblemReSolve
          key={p.id}
          problem={p}
          leaving={leaving.has(p.id)}
          onRecord={record}
        />
      ))}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </section>
  );
}

function ProblemReSolve({
  problem,
  leaving,
  onRecord,
}: {
  problem: ProblemCard;
  leaving: boolean;
  onRecord: (p: ProblemCard, outcome: DsaOutcome) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const today = startOfDay(new Date());
  const overdue = differenceInCalendarDays(today, new Date(problem.nextReview));
  const diffColor = DIFFICULTY_COLORS[problem.difficulty];

  return (
    <div
      className={`rounded-xl border border-edge bg-surface p-3.5 ${
        leaving ? "animate-card-out" : ""
      } ${problem.status === "MASTERED" ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-snug">{problem.title}</span>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${diffColor}22`, color: diffColor }}
          >
            {problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}
          </span>
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          {problem.patterns.map((pat) => (
            <span
              key={pat.id}
              className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
            >
              {pat.name}
            </span>
          ))}
          <span className="text-[11px] text-muted">
            {problem.repetitions + 1}
            {ordinalSuffix(problem.repetitions + 1)} solve
          </span>
          {overdue > 0 && (
            <span className="rounded bg-again/15 px-1.5 py-0.5 text-[11px] font-medium text-again">
              overdue {overdue}d
            </span>
          )}
        </span>
      </div>

      {problem.notes && (
        <div className="mt-3 border-t border-edge pt-3">
          {revealed ? (
            <p className="whitespace-pre-wrap text-sm text-accent">{problem.notes}</p>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="text-xs font-medium uppercase tracking-wide text-muted underline"
            >
              Reveal insight
            </button>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        {OUTCOME_BUTTONS.map((b) => (
          <button
            key={b.outcome}
            type="button"
            disabled={leaving}
            onClick={() => onRecord(problem, b.outcome)}
            className={`rounded-lg border bg-surface-2 py-3 text-xs font-medium active:scale-95 ${b.cls}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

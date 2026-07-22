"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { submitReview } from "@/app/actions";
import { enqueueReview } from "@/lib/outbox";
import type { TopicWithDue } from "@/lib/queries";
import type { Rating } from "@/lib/types";
import { SubjectChip } from "./chip";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const RATING_BUTTONS: { rating: Rating; label: string; cls: string }[] = [
  { rating: "AGAIN", label: "Again", cls: "text-again border-again/40" },
  { rating: "HARD", label: "Hard", cls: "text-hard border-hard/40" },
  { rating: "GOOD", label: "Good", cls: "text-good border-good/40" },
  { rating: "EASY", label: "Easy", cls: "text-easy border-easy/40" },
];

export function TodayList({
  initialTopics,
  reviewedToday,
  streak,
  soleSection = true,
}: {
  initialTopics: TopicWithDue[];
  reviewedToday: number;
  streak: number;
  // When DSA re-solves also share the Today screen, the page owns the unified
  // empty state — so this list should vanish rather than show its own card.
  soleSection?: boolean;
}) {
  const [topics, setTopics] = useState(initialTopics);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [doneCount, setDoneCount] = useState(reviewedToday);
  const [toast, setToast] = useState<string | null>(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  async function rate(topic: TopicWithDue, rating: Rating) {
    setLeaving((s) => new Set(s).add(topic.id));
    try {
      const result = await submitReview(topic.id, rating);
      setToast(
        `Next: ${result.intervalDays} ${result.intervalDays === 1 ? "day" : "days"}` +
          (result.pulledForward ? " (before exam)" : "")
      );
      setTimeout(() => setToast(null), 2000);
      setTimeout(() => {
        setTopics((ts) => ts.filter((t) => t.id !== topic.id));
        setDoneCount((c) => c + 1);
      }, 350);
    } catch {
      // Likely offline — queue the rating and remove the card optimistically;
      // PwaSetup flushes the outbox when connectivity returns.
      try {
        await enqueueReview(topic.id, rating);
        setToast("Offline — review queued");
        setTimeout(() => setToast(null), 2500);
        setTimeout(() => {
          setTopics((ts) => ts.filter((t) => t.id !== topic.id));
          setDoneCount((c) => c + 1);
        }, 350);
      } catch {
        setLeaving((s) => {
          const next = new Set(s);
          next.delete(topic.id);
          return next;
        });
        setToast("Failed to save review — try again");
        setTimeout(() => setToast(null), 3000);
      }
    }
  }

  const overdue = topics.filter(
    (t) => differenceInCalendarDays(today, new Date(t.effectiveNextReview)) > 0
  );
  const dueToday = topics.filter((t) => !overdue.includes(t));

  const bySubject = new Map<string, TopicWithDue[]>();
  for (const t of dueToday) {
    const list = bySubject.get(t.subject.id) ?? [];
    list.push(t);
    bySubject.set(t.subject.id, list);
  }

  if (topics.length === 0) {
    if (!soleSection) return null;
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-edge bg-surface px-6 py-12 text-center">
        <p className="text-lg font-medium">All clear.</p>
        <p className="text-sm text-muted">
          {doneCount} {doneCount === 1 ? "topic" : "topics"} reviewed today.
        </p>
        <p className="text-sm text-accent">{streak}-day streak</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {topics.length} due · {doneCount} done
      </p>

      {overdue.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-again">
            Overdue
          </h2>
          {overdue.map((t) => (
            <TopicCard
              key={t.id}
              topic={t}
              overdueDays={differenceInCalendarDays(
                today,
                new Date(t.effectiveNextReview)
              )}
              leaving={leaving.has(t.id)}
              onRate={rate}
            />
          ))}
        </section>
      )}

      {[...bySubject.values()].map((group) => (
        <section key={group[0].subject.id} className="flex flex-col gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {group[0].subject.name}
          </h2>
          {group.map((t) => (
            <TopicCard
              key={t.id}
              topic={t}
              overdueDays={0}
              leaving={leaving.has(t.id)}
              onRate={rate}
            />
          ))}
        </section>
      ))}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function TopicCard({
  topic,
  overdueDays,
  leaving,
  onRate,
}: {
  topic: TopicWithDue;
  overdueDays: number;
  leaving: boolean;
  onRate: (topic: TopicWithDue, rating: Rating) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(topic.notes) || topic.questions.length > 0;

  return (
    <div
      className={`rounded-xl border border-edge bg-surface p-3.5 ${
        leaving ? "animate-card-out" : ""
      } ${topic.status === "MASTERED" ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => hasDetail && setExpanded((e) => !e)}
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-medium leading-snug">{topic.name}</span>
          <span className="flex flex-wrap items-center gap-2">
            <SubjectChip name={topic.subject.name} color={topic.subject.color} />
            <span className="text-[11px] text-muted">
              {ordinal(topic.repetitions + 1)} review
            </span>
            {overdueDays > 0 && (
              <span className="rounded bg-again/15 px-1.5 py-0.5 text-[11px] font-medium text-again">
                overdue {overdueDays}d
              </span>
            )}
            {topic.pulledForward && (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">
                exam prep
              </span>
            )}
          </span>
        </div>
        {hasDetail && (
          <span className="mt-1 text-xs text-muted">{expanded ? "▴" : "▾"}</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-edge pt-3">
          {topic.notes && (
            <p className="whitespace-pre-wrap text-sm text-muted">{topic.notes}</p>
          )}
          {topic.questions.map((q) => (
            <QuestionPrompt key={q.id} text={q.text} answer={q.answer} />
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        {RATING_BUTTONS.map((b) => (
          <button
            key={b.rating}
            type="button"
            disabled={leaving}
            onClick={() => onRate(topic, b.rating)}
            className={`rounded-lg border bg-surface-2 py-3 text-sm font-medium active:scale-95 ${b.cls}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionPrompt({ text, answer }: { text: string; answer: string | null }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-sm">{text}</p>
      {answer &&
        (revealed ? (
          <p className="mt-2 border-t border-edge pt-2 text-sm text-accent">
            {answer}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-2 text-xs font-medium uppercase tracking-wide text-muted underline"
          >
            Reveal
          </button>
        ))}
    </div>
  );
}

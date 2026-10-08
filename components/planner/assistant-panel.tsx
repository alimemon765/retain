"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  commitAssistantPlan,
  parsePlanText,
  previewAssistantPlan,
  type AssistantDraftResult,
} from "@/app/assistant-actions";
import type { AssistantTask } from "@/lib/assistant/schema";
import { AssistantReview } from "./assistant-review";

type Draft = Extract<AssistantDraftResult, { ok: true }>;
type Stage = "closed" | "input" | "review" | "done";

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const MAX_CHARS = 4000;
const PLACEHOLDER = `Finish the DAA assignment by Friday
Revise search algorithms, maybe 2 hours
Dentist Saturday at 4pm
50 pages of The Anatomy of Story
Gym every evening at 6`;

export function AssistantPanel() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("closed");
  const [text, setText] = useState("");
  const [days, setDays] = useState(3);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(label);
    setError(null);
    try {
      return await fn();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function layOut(tasks: AssistantTask[], extraNotes: string[] = []) {
    const result = await run("Laying out your days…", () => previewAssistantPlan(tasks, days));
    if (!result) return;
    if (!result.ok) return setError(result.error);
    setDraft({ ...result, notes: [...extraNotes, ...result.notes] });
    setStage("review");
  }

  async function read() {
    const parsed = await run("Reading your plan…", () => parsePlanText(text, days));
    if (!parsed) return;
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.tasks.length === 0) {
      return setError("I couldn't find any tasks in that. Try one thing per line.");
    }
    await layOut(parsed.tasks, parsed.notes);
  }

  const edit = (change: (tasks: AssistantTask[]) => AssistantTask[]) => {
    if (draft) void layOut(change(draft.tasks));
  };

  async function commit() {
    if (!draft) return;
    const result = await run("Saving your plan…", () => commitAssistantPlan(draft.tasks, days));
    if (!result) return;
    if (!result.ok) return setError(result.error);
    setSummary(
      `Planned ${result.daysPlanned} ${result.daysPlanned === 1 ? "day" : "days"} and added ` +
        `${result.tasksCreated} ${result.tasksCreated === 1 ? "task" : "tasks"}` +
        (result.synced ? ", and updated Google Calendar." : ".")
    );
    setStage("done");
    setDraft(null);
    setText("");
    router.refresh();
  }

  if (stage === "closed") {
    return (
      <button
        type="button"
        onClick={() => setStage("input")}
        className="flex items-center justify-between rounded-xl border border-accent/40 bg-surface px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-medium text-accent">✦ Plan my next few days</span>
          <span className="block text-xs text-muted">
            Type everything you want to get done — I&apos;ll turn it into tasks and a timetable.
          </span>
        </span>
        <span className="text-muted">›</span>
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-accent">
          ✦ Planning assistant
        </h2>
        <button
          type="button"
          onClick={() => {
            setStage("closed");
            setError(null);
          }}
          className="text-[11px] text-muted underline"
        >
          close
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-again/10 px-3 py-2 text-xs text-again">
          {error}
        </p>
      )}

      {busy && <p className="text-sm text-muted">{busy}</p>}

      {stage === "input" && !busy && (
        <InputStep
          text={text}
          days={days}
          onText={setText}
          onDays={setDays}
          onSubmit={read}
        />
      )}

      {stage === "review" && draft && !busy && (
        <AssistantReview
          draft={draft}
          busy={Boolean(busy)}
          onMove={(id, iso) => edit((ts) => ts.map((t) => (t.id === id ? { ...t, onDate: iso } : t)))}
          onRemove={(id) => edit((ts) => ts.filter((t) => t.id !== id))}
          onCommit={commit}
          onEdit={() => setStage("input")}
        />
      )}

      {stage === "done" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-good">{summary}</p>
          <button
            type="button"
            onClick={() => setStage("input")}
            className="self-start text-xs text-accent underline"
          >
            Plan something else
          </button>
        </div>
      )}
    </section>
  );
}

interface InputStepProps {
  text: string;
  days: number;
  onText: (t: string) => void;
  onDays: (d: number) => void;
  onSubmit: () => void;
}

function InputStep({ text, days, onText, onDays, onSubmit }: InputStepProps) {
  const tooLong = text.length > MAX_CHARS;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">What do you want to get done?</span>
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={6}
          placeholder={PLACEHOLDER}
          className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
        <span className={`text-right text-[11px] ${tooLong ? "text-again" : "text-muted"}`}>
          {text.length}/{MAX_CHARS}
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Plan the next</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Number of days">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => onDays(d)}
              className={`h-9 w-9 rounded-full border text-sm ${
                days === d ? "border-accent bg-accent/15 text-accent" : "border-edge text-muted"
              }`}
            >
              {d}
            </button>
          ))}
          <span className="self-center pl-1 text-xs text-muted">{days === 1 ? "day" : "days"}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!text.trim() || tooLong}
        className="rounded-lg bg-accent py-2.5 text-sm font-medium text-background disabled:opacity-50"
      >
        Read my plan
      </button>
    </div>
  );
}

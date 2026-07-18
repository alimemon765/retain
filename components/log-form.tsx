"use client";

import { useState } from "react";
import { format } from "date-fns";
import { createSubject, createTopic, type NewQuestion } from "@/app/actions";
import type { Source } from "@/lib/types";

const PALETTE = [
  "#e0704a",
  "#5aa7d6",
  "#6f9e6b",
  "#c78fd6",
  "#d6b25a",
  "#d65a8a",
  "#5ad6c0",
  "#9a8cf0",
];

interface SubjectOption {
  id: string;
  name: string;
  color: string;
}

export function LogForm({ subjects }: { subjects: SubjectOption[] }) {
  const [subjectList, setSubjectList] = useState(subjects);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [creatingSubject, setCreatingSubject] = useState(subjects.length === 0);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(PALETTE[0]);

  const [name, setName] = useState("");
  const [source, setSource] = useState<Source>("COLLEGE");
  const [dateStudied, setDateStudied] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState<NewQuestion[]>([]);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function addSubject() {
    if (!newSubjectName.trim()) return;
    const s = await createSubject(newSubjectName, newSubjectColor);
    setSubjectList((l) => [...l, s]);
    setSubjectId(s.id);
    setCreatingSubject(false);
    setNewSubjectName("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !name.trim() || saving) return;
    setSaving(true);
    try {
      await createTopic({
        subjectId,
        name,
        notes: notes || undefined,
        source,
        dateStudied,
        questions,
      });
      // DECISION: keep subject + date after submit — logging 4–6 topics from
      // the same college day is the common case. Only topic-specific fields clear.
      setName("");
      setNotes("");
      setQuestions([]);
      setToast("Scheduled: first review tomorrow");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Subject
        </label>
        <div className="flex flex-wrap gap-2">
          {subjectList.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectId(s.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                subjectId === s.id
                  ? "border-transparent font-medium"
                  : "border-edge text-muted"
              }`}
              style={
                subjectId === s.id
                  ? { backgroundColor: `${s.color}26`, color: s.color }
                  : undefined
              }
            >
              {s.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreatingSubject((v) => !v)}
            className="rounded-full border border-dashed border-edge px-3 py-1.5 text-sm text-muted"
          >
            + new
          </button>
        </div>
        {creatingSubject && (
          <div className="flex flex-col gap-2 rounded-lg border border-edge bg-surface p-3">
            <input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Subject name, e.g. DMM"
              className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
            />
            <div className="flex gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`color ${c}`}
                  onClick={() => setNewSubjectColor(c)}
                  className={`h-7 w-7 rounded-full ${
                    newSubjectColor === c ? "ring-2 ring-foreground" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addSubject}
              className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
            >
              Add subject
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="topic-name"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Topic
        </label>
        <input
          id="topic-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What did you study?"
          required
          className="rounded-lg bg-surface px-3 py-3 outline-none placeholder:text-muted"
        />
      </fieldset>

      <div className="flex gap-3">
        <fieldset className="flex flex-1 flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Source
          </label>
          <div className="flex overflow-hidden rounded-lg border border-edge">
            {(["COLLEGE", "SELF"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`flex-1 py-2.5 text-sm capitalize ${
                  source === s ? "bg-surface-2 font-medium" : "text-muted"
                }`}
              >
                {s.toLowerCase()}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="date-studied"
            className="text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            Date studied
          </label>
          <input
            id="date-studied"
            type="date"
            value={dateStudied}
            max={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => setDateStudied(e.target.value)}
            className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none"
          />
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor="notes"
          className="text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          Notes <span className="normal-case">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Key points, resource links…"
          className="rounded-lg bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Self-test questions
        </label>
        <p className="-mt-1 text-xs text-muted">
          Add 2–3 questions to test yourself later. Future-you will thank you.
        </p>
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-edge bg-surface p-3">
            <div className="flex items-start gap-2">
              <input
                value={q.text}
                onChange={(e) =>
                  setQuestions((qs) =>
                    qs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x))
                  )
                }
                placeholder={`Question ${i + 1}`}
                className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted"
              />
              <button
                type="button"
                aria-label="Remove question"
                onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                className="px-1 py-2 text-muted"
              >
                ✕
              </button>
            </div>
            <input
              value={q.answer ?? ""}
              onChange={(e) =>
                setQuestions((qs) =>
                  qs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x))
                )
              }
              placeholder="Answer / hint (optional)"
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuestions((qs) => [...qs, { text: "", answer: "" }])}
          className="self-start rounded-lg border border-dashed border-edge px-3 py-1.5 text-sm text-muted"
        >
          + add question
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={saving || !subjectId}
        className="rounded-xl bg-accent py-3.5 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : "Log topic"}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </form>
  );
}

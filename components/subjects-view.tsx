"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { deleteTopic, updateSubject, updateTopic } from "@/app/actions";
import type { Status } from "@/lib/types";

interface TopicRow {
  id: string;
  name: string;
  status: string;
  intervalDays: number;
  repetitions: number;
  nextReview: Date;
}

interface SubjectRow {
  id: string;
  name: string;
  color: string;
  examDate: Date | null;
  masteredPct: number;
  topics: TopicRow[];
}

const STATUS_LABEL: Record<string, string> = {
  LEARNING: "learning",
  REVIEWING: "reviewing",
  MASTERED: "mastered",
  SUSPENDED: "suspended",
};

export function SubjectsView({ subjects }: { subjects: SubjectRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      {subjects.length === 0 && (
        <p className="text-sm text-muted">
          No subjects yet — create one from the Log screen.
        </p>
      )}
      {subjects.map((s) => (
        <SubjectCard
          key={s.id}
          subject={s}
          open={open === s.id}
          onToggle={() => setOpen((o) => (o === s.id ? null : s.id))}
          refresh={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function SubjectCard({
  subject,
  open,
  onToggle,
  refresh,
}: {
  subject: SubjectRow;
  open: boolean;
  onToggle: () => void;
  refresh: () => void;
}) {
  const [editingExam, setEditingExam] = useState(false);
  const [examValue, setExamValue] = useState(
    subject.examDate ? format(new Date(subject.examDate), "yyyy-MM-dd") : ""
  );
  const today = startOfDay(new Date());
  const daysToExam = subject.examDate
    ? differenceInCalendarDays(new Date(subject.examDate), today)
    : null;

  async function saveExam() {
    await updateSubject(subject.id, {
      examDate: examValue ? new Date(`${examValue}T00:00:00`) : null,
    });
    setEditingExam(false);
    refresh();
  }

  return (
    <div
      className="rounded-xl border border-edge bg-surface"
      style={{ borderLeft: `3px solid ${subject.color}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
      >
        <div>
          <p className="font-medium" style={{ color: subject.color }}>
            {subject.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {subject.topics.length} topics · {subject.masteredPct}% mastered
            {daysToExam !== null &&
              daysToExam >= 0 &&
              ` · exam in ${daysToExam}d`}
          </p>
        </div>
        <span className="text-xs text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-edge p-3.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Exam:</span>
            {editingExam ? (
              <>
                <input
                  type="date"
                  value={examValue}
                  onChange={(e) => setExamValue(e.target.value)}
                  className="rounded-lg bg-surface-2 px-2 py-1 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={saveExam}
                  className="rounded bg-accent px-2 py-1 text-xs font-medium text-background"
                >
                  Save
                </button>
                {subject.examDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setExamValue("");
                      void updateSubject(subject.id, { examDate: null }).then(
                        () => {
                          setEditingExam(false);
                          refresh();
                        }
                      );
                    }}
                    className="text-xs text-muted underline"
                  >
                    Clear
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditingExam(true)}
                className="text-accent underline"
              >
                {subject.examDate
                  ? format(new Date(subject.examDate), "d MMM yyyy")
                  : "set date"}
              </button>
            )}
          </div>

          {subject.topics.map((t) => (
            <TopicRowView key={t.id} topic={t} refresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRowView({ topic, refresh }: { topic: TopicRow; refresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const suspended = topic.status === "SUSPENDED";

  async function saveName() {
    if (name.trim() && name !== topic.name) {
      await updateTopic(topic.id, { name: name.trim() });
      refresh();
    }
    setEditing(false);
  }

  async function toggleSuspend() {
    // Resuming: back to REVIEWING (or LEARNING if never succeeded).
    const status: Status = suspended
      ? topic.repetitions > 0
        ? "REVIEWING"
        : "LEARNING"
      : "SUSPENDED";
    await updateTopic(topic.id, { status });
    refresh();
  }

  async function remove() {
    if (confirm(`Delete "${topic.name}" and its review history?`)) {
      await deleteTopic(topic.id);
      refresh();
    }
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg bg-surface-2 px-3 py-2.5 ${
        suspended ? "opacity-50" : ""
      }`}
    >
      {editing ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          autoFocus
          className="rounded bg-background px-2 py-1 text-sm outline-none"
        />
      ) : (
        <p className="text-sm">{topic.name}</p>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          {STATUS_LABEL[topic.status]} · {topic.intervalDays}d interval · next{" "}
          {format(new Date(topic.nextReview), "d MMM")}
        </span>
        <span className="flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="underline">
            edit
          </button>
          <button type="button" onClick={toggleSuspend} className="underline">
            {suspended ? "resume" : "suspend"}
          </button>
          <button type="button" onClick={remove} className="text-again underline">
            delete
          </button>
        </span>
      </div>
    </div>
  );
}

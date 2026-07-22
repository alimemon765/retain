"use client";

import { useState } from "react";
import { LogForm } from "./log-form";
import { ProblemForm } from "./problem-form";
import { ReadingForm, type ReadingBookOption } from "./reading-form";

type Segment = "topic" | "problem" | "reading" | "skill";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "topic", label: "Topic" },
  { key: "problem", label: "Problem" },
  { key: "reading", label: "Reading" },
  { key: "skill", label: "Skill" },
];

interface SubjectOption {
  id: string;
  name: string;
  color: string;
}
interface PatternOption {
  id: string;
  name: string;
}

export function LogTabs({
  subjects,
  patterns,
  readingBooks,
}: {
  subjects: SubjectOption[];
  patterns: PatternOption[];
  readingBooks: ReadingBookOption[];
}) {
  const [segment, setSegment] = useState<Segment>("topic");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-edge bg-surface p-1">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSegment(s.key)}
            className={`rounded-md py-1.5 text-sm ${
              segment === s.key
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {segment === "topic" && <LogForm subjects={subjects} />}
      {segment === "problem" && <ProblemForm patterns={patterns} />}
      {segment === "reading" && <ReadingForm books={readingBooks} />}
      {segment === "skill" && (
        <p className="rounded-xl border border-dashed border-edge bg-surface px-6 py-12 text-center text-sm text-muted">
          Skill log coming soon.
        </p>
      )}
    </div>
  );
}

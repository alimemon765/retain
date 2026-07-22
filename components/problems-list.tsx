"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { deleteProblem, updateProblemStatus } from "@/app/dsa-actions";
import { DIFFICULTY_COLORS } from "@/lib/dsa";
import { DIFFICULTIES, type Difficulty, type Status } from "@/lib/types";
import type { ProblemCard } from "@/lib/queries-dsa";

const STATUSES: Status[] = ["LEARNING", "REVIEWING", "MASTERED", "SUSPENDED"];

export function ProblemsList({
  problems,
  patterns,
}: {
  problems: ProblemCard[];
  patterns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [patternId, setPatternId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [status, setStatus] = useState<Status | "">("");

  const filtered = useMemo(
    () =>
      problems.filter(
        (p) =>
          (!patternId || p.patterns.some((x) => x.id === patternId)) &&
          (!difficulty || p.difficulty === difficulty) &&
          (!status || p.status === status)
      ),
    [problems, patternId, difficulty, status]
  );

  if (problems.length === 0) {
    return (
      <p className="text-sm text-muted">
        No problems yet — log one from the Log screen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <select
          value={patternId}
          onChange={(e) => setPatternId(e.target.value)}
          className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none"
        >
          <option value="">All patterns</option>
          {patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
            className="flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none"
          >
            <option value="">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "")}
            className="flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none"
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted">
        {filtered.length} of {problems.length}
      </p>

      {filtered.map((p) => (
        <ProblemRow key={p.id} problem={p} refresh={() => router.refresh()} />
      ))}
    </div>
  );
}

function ProblemRow({
  problem,
  refresh,
}: {
  problem: ProblemCard;
  refresh: () => void;
}) {
  const suspended = problem.status === "SUSPENDED";
  const diffColor = DIFFICULTY_COLORS[problem.difficulty];

  async function toggleSuspend() {
    const next: Status = suspended
      ? problem.repetitions > 0
        ? "REVIEWING"
        : "LEARNING"
      : "SUSPENDED";
    await updateProblemStatus(problem.id, next);
    refresh();
  }

  async function remove() {
    if (confirm(`Delete "${problem.title}" and its attempt history?`)) {
      await deleteProblem(problem.id);
      refresh();
    }
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-edge bg-surface p-3 ${
        suspended ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {problem.url ? (
          <a
            href={problem.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline decoration-edge underline-offset-2"
          >
            {problem.title}
          </a>
        ) : (
          <span className="text-sm font-medium">{problem.title}</span>
        )}
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${diffColor}22`, color: diffColor }}
        >
          {problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {problem.patterns.map((pat) => (
          <span
            key={pat.id}
            className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
          >
            {pat.name}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          {problem.status.toLowerCase()} · next {format(new Date(problem.nextReview), "d MMM")}
        </span>
        <span className="flex gap-3">
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

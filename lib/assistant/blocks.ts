import { addDays, format, parseISO } from "date-fns";
import { toManualCandidate } from "../candidates";
import { localDay } from "../dates";
import type { Candidate, PlannerBlock } from "../planner";
import { fromMinutes, toMinutes } from "../timetable";
import type { Assignment } from "./distribute";

// Pure bridges between the assistant's assignments and the day scheduler.

export const MIN_DAYS = 1;
export const MAX_DAYS = 7;
export const DEFAULT_DAYS = 3;
const DAY_MINUTES = 24 * 60;

export function clampDayCount(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(Math.max(Math.round(n), MIN_DAYS), MAX_DAYS);
}

/** `count` consecutive yyyy-MM-dd dates starting at `startIso`. */
export function planningWindow(startIso: string, count: number): string[] {
  const start = parseISO(startIso);
  return Array.from({ length: count }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

export const isoToDate = (iso: string): Date => localDay(new Date(`${iso}T00:00:00`));

/** A timed commitment ("dentist 4pm") becomes a locked block the scheduler works around. */
export function fixedBlock(a: Assignment): PlannerBlock {
  const start = toMinutes(a.task.fixedStart ?? "00:00");
  return {
    startTime: fromMinutes(start),
    endTime: fromMinutes(Math.min(start + a.task.estimateMins, DAY_MINUTES)),
    kind: "CUSTOM",
    title: a.task.title,
    topicIds: [],
    problemIds: [],
    taskIds: [],
    locked: true,
  };
}

/** A flexible task, scheduled under its draft instance id until it is saved. */
export function assignmentCandidate(a: Assignment): Candidate {
  return toManualCandidate(
    {
      id: a.instanceId,
      title: a.task.title,
      kind: a.task.kind,
      estimateMins: a.task.estimateMins,
      priority: a.task.priority,
      dueDate: a.task.deadline ? isoToDate(a.task.deadline) : null,
    },
    isoToDate(a.iso)
  );
}

/** Replace draft ids with saved ids; unmapped ids are dropped, never saved dangling. */
export function remapTaskIds<T extends { taskIds: readonly string[] }>(
  blocks: readonly T[],
  idMap: ReadonlyMap<string, string>
): (Omit<T, "taskIds"> & { taskIds: string[] })[] {
  return blocks.map((b) => ({
    ...b,
    taskIds: b.taskIds.flatMap((id) => {
      const saved = idMap.get(id);
      return saved ? [saved] : [];
    }),
  }));
}

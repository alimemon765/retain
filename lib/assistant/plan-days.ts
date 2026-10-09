import { buildDayPlan, type IgnoredWork, type PlacedRef, type PlanPreview } from "../day-plan";
import type { FocusMode } from "../types";
import { assignmentCandidate, fixedBlock, isoToDate } from "./blocks";
import {
  distributeTasks,
  type Assignment,
  type DayCapacity,
  type OverflowItem,
} from "./distribute";
import type { AssistantTask } from "./schema";

// Multi-day planning on top of the single-day scheduler. Days run in order
// because each one must know what earlier days already took — otherwise one
// overdue review would be booked on every day of the window.

export interface DayDraft {
  iso: string;
  preview: PlanPreview;
  assignments: Assignment[];
}

export interface MultiDayDraft {
  days: DayDraft[];
  overflow: OverflowItem[];
}

function placedFrom(preview: PlanPreview): PlacedRef {
  return {
    topicIds: preview.blocks.flatMap((b) => b.topicIds),
    problemIds: preview.blocks.flatMap((b) => b.problemIds),
    taskIds: preview.blocks.flatMap((b) => b.taskIds),
  };
}

export interface PlanDaysOptions {
  focusMode?: FocusMode;
  ignore?: IgnoredWork;
}

/** How much new work each day can take once its own due work is placed. */
async function measureCapacity(
  window: readonly string[],
  { focusMode, ignore }: PlanDaysOptions
): Promise<DayCapacity[]> {
  const capacities: DayCapacity[] = [];
  const placed: PlacedRef[] = [];
  for (const iso of window) {
    const { preview, capacityMins } = await buildDayPlan(isoToDate(iso), {
      focusMode,
      ignore,
      placedEarlier: placed,
    });
    capacities.push({ iso, capacityMins });
    placed.push(placedFrom(preview));
  }
  return capacities;
}

export async function planDays(
  tasks: readonly AssistantTask[],
  window: readonly string[],
  opts: PlanDaysOptions = {}
): Promise<MultiDayDraft> {
  const capacities = await measureCapacity(window, opts);
  const { assignments, overflow } = distributeTasks(tasks, capacities);

  const days: DayDraft[] = [];
  const placed: PlacedRef[] = [];
  for (const iso of window) {
    const mine = assignments.filter((a) => a.iso === iso);
    const { preview } = await buildDayPlan(isoToDate(iso), {
      focusMode: opts.focusMode,
      ignore: opts.ignore,
      placedEarlier: placed,
      extraCandidates: mine.filter((a) => a.task.fixedStart === null).map(assignmentCandidate),
      extraLocked: mine.filter((a) => a.task.fixedStart !== null).map(fixedBlock),
    });
    days.push({ iso, preview, assignments: mine });
    placed.push(placedFrom(preview));
  }
  return { days, overflow };
}

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { dayKey, today } from "./dates";
import {
  excludePlaced,
  gatherCandidates,
  taskIdsPlacedOnOtherDays,
} from "./candidates";
import {
  generatePlan,
  type Candidate,
  type PlannerBlock,
  type PlannerException,
} from "./planner";
import {
  getBlocksForDate,
  getClassSlots,
  getExceptions,
  getPlannerSettings,
  type PlannedBlockRow,
} from "./queries-planner";
import type { FocusMode } from "./types";

// One day's plan, built the same way whether it comes from "Optimize my day"
// or the AI assistant. Server-only (reads the DB) but not a server action, so
// the extra-candidate hooks below can't be called directly from the browser.

export interface PlanPreview {
  blocks: PlannerBlock[];
  /** Human-readable diff against what is currently saved for that day. */
  added: string[];
  removed: string[];
  kept: number;
  overflow: { id: string; title: string; kind: string; estimateMins: number }[];
  warnings: string[];
  scheduledMinutes: number;
  freeMinutes: number;
}

/** What earlier days of a multi-day draft already cover. */
export interface PlacedRef {
  topicIds: string[];
  problemIds: string[];
  taskIds: string[];
}

export interface DayPlanOptions {
  focusMode?: FocusMode;
  extraCandidates?: readonly Candidate[];
  extraLocked?: readonly PlannerBlock[];
  placedEarlier?: readonly PlacedRef[];
  /** Earlier assistant work being replaced: plan as if it were already gone. */
  ignore?: IgnoredWork;
}

export interface IgnoredWork {
  taskIds: readonly string[];
  blockIds: readonly string[];
}

export interface DayPlanResult {
  preview: PlanPreview;
  /** Minutes of work still free after the day's own due work is placed. */
  capacityMins: number;
}

const signature = (b: { startTime: string; endTime: string; title: string }) =>
  `${b.startTime}-${b.endTime} ${b.title}`;

/** Manual placements and anything already ticked off are preserved verbatim. */
function lockedFromExisting(existing: readonly PlannedBlockRow[]): PlannerBlock[] {
  return existing
    .filter((b) => b.locked || b.completed)
    .map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      kind: b.kind as PlannerBlock["kind"],
      title: b.title,
      topicIds: b.topicIds,
      problemIds: b.problemIds,
      taskIds: b.taskIds,
      bookId: b.bookId ?? undefined,
      skillId: b.skillId ?? undefined,
      locked: true,
      completed: b.completed,
      existingId: b.id,
    }));
}

export async function placedElsewhere(date: Date): Promise<Set<string>> {
  const now = today();
  const rows = await prisma.plannedBlock.findMany({
    where: { date: { gte: now }, NOT: { taskIds: { isEmpty: true } } },
    select: { date: true, taskIds: true },
  });
  return taskIdsPlacedOnOtherDays(
    rows.map((r) => ({ iso: dayKey(r.date), taskIds: r.taskIds })),
    dayKey(date),
    dayKey(now)
  );
}

async function candidatesFor(
  date: Date,
  existing: readonly PlannedBlockRow[],
  opts: DayPlanOptions
): Promise<Candidate[]> {
  const [due, elsewhere] = await Promise.all([gatherCandidates(date), placedElsewhere(date)]);
  const ignoredTasks = new Set(opts.ignore?.taskIds ?? []);
  const covered = [
    ...existing.filter((b) => b.locked || b.completed),
    ...(opts.placedEarlier ?? []).map((p) => ({ ...p, bookId: null, skillId: null })),
  ];
  return [
    ...excludePlaced(due, covered).filter(
      (c) => !c.taskId || (!elsewhere.has(c.taskId) && !ignoredTasks.has(c.taskId))
    ),
    ...(opts.extraCandidates ?? []),
  ];
}

export async function buildDayPlan(date: Date, opts: DayPlanOptions = {}): Promise<DayPlanResult> {
  const [settings, classSlots, exceptionRows, saved] = await Promise.all([
    getPlannerSettings(),
    getClassSlots(),
    getExceptions(date, date),
    getBlocksForDate(date),
  ]);

  // Blocks being replaced still count as "removed" in the diff below.
  const ignoredBlocks = new Set(opts.ignore?.blockIds ?? []);
  const existing = saved.filter((b) => !ignoredBlocks.has(b.id));

  const exceptions: PlannerException[] = exceptionRows.map((e) => ({
    kind: e.kind as PlannerException["kind"],
    label: e.label,
    startTime: e.startTime,
    endTime: e.endTime,
  }));

  const { blocks, summary } = generatePlan({
    date,
    settings: { ...settings, focusMode: opts.focusMode ?? settings.focusMode },
    classSlots,
    exceptions,
    candidates: await candidatesFor(date, existing, opts),
    lockedBlocks: [...lockedFromExisting(existing), ...(opts.extraLocked ?? [])],
  });

  const before = new Set(existing.map(signature));
  const replaced = saved.filter((b) => ignoredBlocks.has(b.id)).map(signature);
  const after = new Set(blocks.map(signature));
  const preview: PlanPreview = {
    blocks,
    added: blocks.filter((b) => !before.has(signature(b))).map(signature),
    removed: [...existing.filter((b) => !after.has(signature(b))).map(signature), ...replaced],
    kept: blocks.filter((b) => before.has(signature(b))).length,
    overflow: summary.overflow.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      estimateMins: c.estimateMins,
    })),
    warnings: summary.warnings,
    scheduledMinutes: summary.scheduledMinutes,
    freeMinutes: summary.freeMinutes,
  };
  const capacityMins = Math.max(
    summary.freeMinutes - summary.reservedSlackMinutes - summary.scheduledMinutes,
    0
  );
  return { preview, capacityMins };
}

const keptIds = (blocks: readonly PlannerBlock[]) =>
  blocks.map((b) => b.existingId).filter((id): id is string => Boolean(id));

/** Calendar events that belong to blocks a new plan is about to replace. */
export async function eventIdsToReplace(
  date: Date,
  blocks: readonly PlannerBlock[]
): Promise<string[]> {
  const doomed = await prisma.plannedBlock.findMany({
    where: { date, id: { notIn: keptIds(blocks) }, gcalEventId: { not: null } },
    select: { gcalEventId: true },
  });
  return doomed.flatMap((d) => (d.gcalEventId ? [d.gcalEventId] : []));
}

/** Replace a day's blocks inside a transaction the caller owns. */
export async function replaceDayBlocks(
  tx: Prisma.TransactionClient,
  date: Date,
  blocks: readonly PlannerBlock[],
  isAssistantBlock: (b: PlannerBlock) => boolean = () => false
): Promise<void> {
  await tx.plannedBlock.deleteMany({ where: { date, id: { notIn: keptIds(blocks) } } });
  await tx.plannedBlock.createMany({
    data: blocks
      .filter((b) => !b.existingId)
      .map((b) => ({
        date,
        startTime: b.startTime,
        endTime: b.endTime,
        kind: b.kind,
        title: b.title,
        topicIds: b.topicIds,
        problemIds: b.problemIds,
        taskIds: b.taskIds,
        bookId: b.bookId ?? null,
        skillId: b.skillId ?? null,
        locked: b.locked,
        fromAssistant: isAssistantBlock(b),
      })),
  });
}

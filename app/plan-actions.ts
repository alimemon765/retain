"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { localDay } from "@/lib/dates";
import { excludePlaced, gatherCandidates } from "@/lib/candidates";
import {
  generatePlan,
  type PlannerBlock,
  type PlannerException,
} from "@/lib/planner";
import {
  getBlocksForDate,
  getClassSlots,
  getExceptions,
  getPlannerSettings,
} from "@/lib/queries-planner";
import { fromMinutes, toMinutes } from "@/lib/timetable";
import type { FocusMode } from "@/lib/types";

function revalidatePlanner() {
  for (const p of ["/", "/planner"]) revalidatePath(p);
}

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

function signature(b: { startTime: string; endTime: string; title: string }) {
  return `${b.startTime}-${b.endTime} ${b.title}`;
}

/** Run the scheduler for a date and diff it against the saved plan. Never writes. */
export async function previewPlan(
  dateISO: string,
  focusMode?: FocusMode
): Promise<PlanPreview> {
  const date = localDay(new Date(`${dateISO}T00:00:00`));
  const [settings, classSlots, exceptionRows, existing, candidates] =
    await Promise.all([
      getPlannerSettings(),
      getClassSlots(),
      getExceptions(date, date),
      getBlocksForDate(date),
      gatherCandidates(),
    ]);

  const exceptions: PlannerException[] = exceptionRows.map((e) => ({
    kind: e.kind as PlannerException["kind"],
    label: e.label,
    startTime: e.startTime,
    endTime: e.endTime,
  }));

  // Manual placements and anything already ticked off are preserved verbatim.
  const lockedBlocks: PlannerBlock[] = existing
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

  const { blocks, summary } = generatePlan({
    date,
    settings: { ...settings, focusMode: focusMode ?? settings.focusMode },
    classSlots,
    exceptions,
    // Anything a locked/completed block already covers must not be re-planned.
    candidates: excludePlaced(
      candidates,
      existing.filter((b) => b.locked || b.completed)
    ),
    lockedBlocks,
  });

  const before = new Set(existing.map(signature));
  const after = new Set(blocks.map(signature));

  return {
    blocks,
    added: blocks.filter((b) => !before.has(signature(b))).map(signature),
    removed: existing.filter((b) => !after.has(signature(b))).map(signature),
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
}

/** Commit a previewed plan, preserving locked/completed rows and their gcal ids. */
export async function applyPlan(dateISO: string, blocks: PlannerBlock[]) {
  const date = localDay(new Date(`${dateISO}T00:00:00`));
  const keepIds = new Set(
    blocks.map((b) => b.existingId).filter((id): id is string => Boolean(id))
  );

  await prisma.$transaction([
    // Everything not carried over is replaced.
    prisma.plannedBlock.deleteMany({
      where: { date, id: { notIn: [...keepIds] } },
    }),
    prisma.plannedBlock.createMany({
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
        })),
    }),
  ]);

  revalidatePlanner();
  return { count: blocks.length };
}

/**
 * Work that today's plan does not cover. Recomputed rather than stored: due
 * items are derived state, so a saved copy would go stale the moment I do one.
 */
export async function getOverflow(dateISO: string) {
  const date = localDay(new Date(`${dateISO}T00:00:00`));
  const [blocks, candidates] = await Promise.all([
    getBlocksForDate(date),
    gatherCandidates(),
  ]);
  const missed = excludePlaced(candidates, blocks);
  return missed.map((c) => ({
    id: c.id,
    title: c.title,
    kind: c.kind,
    estimateMins: c.estimateMins,
    // DECISION: only manual tasks can be "pushed" — SM-2 items are still due
    // tomorrow by definition, so they reappear on their own.
    taskId: c.taskId ?? null,
  }));
}

/** Push a manual task's due date to tomorrow. */
export async function pushTaskToTomorrow(taskId: string) {
  const tomorrow = localDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  await prisma.manualTask.update({
    where: { id: taskId },
    data: { dueDate: tomorrow },
  });
  revalidatePlanner();
}

// ---------- per-block controls ----------

export async function setBlockCompleted(id: string, completed: boolean) {
  await prisma.plannedBlock.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  });
  revalidatePlanner();
}

export async function setBlockLocked(id: string, locked: boolean) {
  await prisma.plannedBlock.update({ where: { id }, data: { locked } });
  revalidatePlanner();
}

export async function deleteBlock(id: string) {
  await prisma.plannedBlock.delete({ where: { id } });
  revalidatePlanner();
}

/** Extend a block's end, capped at the next block's start (never overlap). */
export async function extendBlock(id: string, minutes: number) {
  const block = await prisma.plannedBlock.findUniqueOrThrow({ where: { id } });
  const sameDay = await prisma.plannedBlock.findMany({
    where: { date: block.date },
    orderBy: { startTime: "asc" },
  });
  const next = sameDay.find(
    (b) => toMinutes(b.startTime) >= toMinutes(block.endTime) && b.id !== id
  );
  const ceiling = next ? toMinutes(next.startTime) : 24 * 60;
  const wanted = toMinutes(block.endTime) + minutes;
  if (wanted > ceiling) {
    return { extended: false, reason: "The next block starts too soon." };
  }
  await prisma.plannedBlock.update({
    where: { id },
    data: { endTime: fromMinutes(wanted), locked: true },
  });
  revalidatePlanner();
  return { extended: true };
}

/** Move a block into the next stretch of unclaimed time on the same day. */
export async function rescheduleBlock(id: string) {
  const block = await prisma.plannedBlock.findUniqueOrThrow({ where: { id } });
  const duration = toMinutes(block.endTime) - toMinutes(block.startTime);
  const sameDay = await prisma.plannedBlock.findMany({
    where: { date: block.date, id: { not: id } },
    orderBy: { startTime: "asc" },
  });

  const target = sameDay.find(
    (b) =>
      (b.kind === "BUFFER" || b.kind === "BREAK") &&
      toMinutes(b.startTime) > toMinutes(block.startTime) &&
      toMinutes(b.endTime) - toMinutes(b.startTime) >= duration
  );
  if (!target) {
    return { moved: false, reason: "No free slot later today." };
  }

  const newStart = toMinutes(target.startTime);
  const newEnd = newStart + duration;
  const targetEnd = toMinutes(target.endTime);

  await prisma.$transaction([
    prisma.plannedBlock.update({
      where: { id },
      data: {
        startTime: target.startTime,
        endTime: fromMinutes(newEnd),
        locked: true,
      },
    }),
    // Shrink the slot we moved into; if it is fully consumed, drop it rather
    // than leaving a zero-length row behind.
    newEnd >= targetEnd
      ? prisma.plannedBlock.delete({ where: { id: target.id } })
      : prisma.plannedBlock.update({
          where: { id: target.id },
          data: { startTime: fromMinutes(newEnd) },
        }),
    // The vacated time becomes buffer.
    prisma.plannedBlock.create({
      data: {
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        kind: "BUFFER",
        title: "Freed up",
      },
    }),
  ]);
  revalidatePlanner();
  return { moved: true, to: target.startTime };
}

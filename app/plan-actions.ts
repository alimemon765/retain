"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { localDay } from "@/lib/dates";
import { excludePlaced, gatherCandidates } from "@/lib/candidates";
import type { PlannerBlock } from "@/lib/planner";
import { getBlocksForDate } from "@/lib/queries-planner";
import {
  buildDayPlan,
  eventIdsToReplace,
  placedElsewhere,
  replaceDayBlocks,
} from "@/lib/day-plan";
import type { PlanPreview } from "@/lib/day-plan";
import { deleteEvents } from "@/lib/gcal";
import { setBlockCompletion } from "@/lib/block-completion";
import { fromMinutes, toMinutes } from "@/lib/timetable";
import type { FocusMode } from "@/lib/types";

function revalidatePlanner() {
  for (const p of ["/", "/planner"]) revalidatePath(p);
}

/** Run the scheduler for a date and diff it against the saved plan. Never writes. */
export async function previewPlan(
  dateISO: string,
  focusMode?: FocusMode
): Promise<PlanPreview> {
  const date = localDay(new Date(`${dateISO}T00:00:00`));
  const { preview } = await buildDayPlan(date, { focusMode });
  return preview;
}

/** Commit a previewed plan, preserving locked/completed rows and their gcal ids. */
export async function applyPlan(dateISO: string, blocks: PlannerBlock[]) {
  const date = localDay(new Date(`${dateISO}T00:00:00`));
  // Replaced blocks take their calendar events with them, otherwise Google
  // keeps announcing work that is no longer planned.
  await deleteEvents(await eventIdsToReplace(date, blocks));
  await prisma.$transaction((tx) => replaceDayBlocks(tx, date, blocks));
  revalidatePlanner();
  return { count: blocks.length };
}

/**
 * Work that today's plan does not cover. Recomputed rather than stored: due
 * items are derived state, so a saved copy would go stale the moment I do one.
 */
export async function getOverflow(dateISO: string) {
  const date = localDay(new Date(`${dateISO}T00:00:00`));
  const [blocks, candidates, elsewhere] = await Promise.all([
    getBlocksForDate(date),
    gatherCandidates(date),
    placedElsewhere(date),
  ]);
  // Work already booked on another day is planned, not missing.
  const missed = excludePlaced(candidates, blocks).filter(
    (c) => !c.taskId || !elsewhere.has(c.taskId)
  );
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
  await setBlockCompletion(id, completed);
  revalidatePlanner();
}

export async function setBlockLocked(id: string, locked: boolean) {
  await prisma.plannedBlock.update({ where: { id }, data: { locked } });
  revalidatePlanner();
}

export async function deleteBlock(id: string) {
  const block = await prisma.plannedBlock.findUnique({
    where: { id },
    select: { gcalEventId: true },
  });
  if (block?.gcalEventId) await deleteEvents([block.gcalEventId]);
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

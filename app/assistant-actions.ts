"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dayKey, today } from "@/lib/dates";
import { getPlannerSettings } from "@/lib/queries-planner";
import { getReadingNudges } from "@/lib/queries-books";
import { deleteEvents, gcalConfigured, syncDay } from "@/lib/gcal";
import { MAX_INPUT_CHARS, extractTasks, type ExtractResult } from "@/lib/assistant/extract";
import { MAX_TASKS, normalizeTasks } from "@/lib/assistant/normalize";
import { RawAssistantTaskSchema, type AssistantTask } from "@/lib/assistant/schema";
import { planDays, type MultiDayDraft } from "@/lib/assistant/plan-days";
import {
  clampDayCount,
  isoToDate,
  planningWindow,
  remapTaskIds,
} from "@/lib/assistant/blocks";
import { eventIdsToReplace, replaceDayBlocks } from "@/lib/day-plan";

const COMMIT_TIMEOUT_MS = 20_000;

// The browser holds the draft between steps, so everything it sends back is
// re-validated here: the server never trusts a task list or a block list.
const ClientTasksSchema = z
  .array(
    RawAssistantTaskSchema.extend({
      id: z.string().max(64),
      title: z.string().max(500),
      deadline: z.string().max(10).nullable(),
      onDate: z.string().max(10).nullable(),
      fixedStart: z.string().max(5).nullable(),
    })
  )
  .max(MAX_TASKS);

type Fail = { ok: false; error: string };

export type AssistantDraftResult =
  | { ok: true; window: string[]; tasks: AssistantTask[]; draft: MultiDayDraft; notes: string[] }
  | Fail;

export type AssistantCommitResult =
  | { ok: true; daysPlanned: number; tasksCreated: number; synced: boolean }
  | Fail;

function windowFor(dayCount: unknown): string[] {
  const count = clampDayCount(typeof dayCount === "number" ? dayCount : Number.NaN);
  return planningWindow(dayKey(today()), count);
}

/** Validate and re-clean tasks the browser sent back. */
async function checkTasks(raw: unknown, window: string[]) {
  const parsed = ClientTasksSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { maxBlockMinutes } = await getPlannerSettings();
  return normalizeTasks(parsed.data, { days: window, maxBlockMinutes });
}

/** Step 1: read the free text with Claude. Writes nothing. */
export async function parsePlanText(text: unknown, dayCount: unknown): Promise<ExtractResult> {
  if (typeof text !== "string") return { ok: false, error: "Nothing to read." };
  // Reject oversize input before doing any database work.
  if (text.trim().length > MAX_INPUT_CHARS) {
    return { ok: false, error: `That's too long. Keep it under ${MAX_INPUT_CHARS} characters.` };
  }
  const window = windowFor(dayCount);
  const [settings, subjects, reading] = await Promise.all([
    getPlannerSettings(),
    prisma.subject.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    getReadingNudges(),
  ]);
  return extractTasks(text, {
    todayIso: window[0],
    days: window,
    maxBlockMinutes: settings.maxBlockMinutes,
    subjects: subjects.map((s) => s.name),
    books: reading.map((b) => b.title),
  });
}

/** Step 2: lay the tasks out across the days. Writes nothing. */
export async function previewAssistantPlan(
  tasks: unknown,
  dayCount: unknown
): Promise<AssistantDraftResult> {
  const window = windowFor(dayCount);
  const checked = await checkTasks(tasks, window);
  if (!checked) return { ok: false, error: "Those tasks didn't look right. Start over." };
  const draft = await planDays(checked.tasks, window);
  return { ok: true, window, tasks: checked.tasks, draft, notes: checked.notes };
}

/** Save each flexible task (including ones that didn't fit) so nothing is lost. */
async function saveTasks(
  tx: Prisma.TransactionClient,
  draft: MultiDayDraft,
  tasks: AssistantTask[]
): Promise<Map<string, string>> {
  const assigned = draft.days.flatMap((d) => d.assignments);
  const assignedIds = new Set(assigned.map((a) => a.taskId));
  const unplaced = tasks.filter((t) => !assignedIds.has(t.id) && t.fixedStart === null);

  const rows = [
    ...assigned
      .filter((a) => a.task.fixedStart === null)
      .map((a) => ({ draftId: a.instanceId, task: a.task })),
    ...unplaced.map((t) => ({ draftId: t.id, task: t })),
  ];
  const idMap = new Map<string, string>();
  for (const { draftId, task } of rows) {
    const created = await tx.manualTask.create({
      data: {
        title: task.title,
        estimateMins: task.estimateMins,
        kind: task.kind,
        priority: task.priority,
        dueDate: task.deadline ? isoToDate(task.deadline) : null,
      },
    });
    idMap.set(draftId, created.id);
  }
  return idMap;
}

/** Push the new days to Google Calendar if it is connected. Never fatal. */
async function trySync(window: string[]): Promise<boolean> {
  if (!gcalConfigured()) return false;
  const { gcalConnected, gcalAuthExpired } = await getPlannerSettings();
  if (!gcalConnected || gcalAuthExpired) return false;
  try {
    for (const iso of window) await syncDay(isoToDate(iso));
    return true;
  } catch (error) {
    console.error("[assistant] calendar sync failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Step 3: save the tasks and the timetable. Recomputed server-side, never trusted. */
export async function commitAssistantPlan(
  tasks: unknown,
  dayCount: unknown
): Promise<AssistantCommitResult> {
  const window = windowFor(dayCount);
  const checked = await checkTasks(tasks, window);
  if (!checked || checked.tasks.length === 0) {
    return { ok: false, error: "There's nothing to plan. Start over." };
  }

  try {
    const draft = await planDays(checked.tasks, window);
    const days = draft.days.map((d) => ({ date: isoToDate(d.iso), blocks: d.preview.blocks }));
    const staleEvents = (
      await Promise.all(days.map((d) => eventIdsToReplace(d.date, d.blocks)))
    ).flat();

    // All-or-nothing: tasks and every day's blocks commit together, so a
    // failure can't leave half a plan behind or duplicate tasks on retry.
    const tasksCreated = await prisma.$transaction(
      async (tx) => {
        const idMap = await saveTasks(tx, draft, checked.tasks);
        for (const d of days) await replaceDayBlocks(tx, d.date, remapTaskIds(d.blocks, idMap));
        return idMap.size;
      },
      { timeout: COMMIT_TIMEOUT_MS }
    );

    // Only once the new plan is safely saved do the old events go.
    await deleteEvents(staleEvents);
    const synced = await trySync(window);
    revalidatePath("/planner");
    revalidatePath("/");
    return { ok: true, daysPlanned: draft.days.length, tasksCreated, synced };
  } catch (error) {
    console.error("[assistant] commit failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Saving the plan failed, so nothing was changed. Try again." };
  }
}

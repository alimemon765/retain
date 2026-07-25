"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { localDay } from "@/lib/dates";
import { parseTimetable, type ParsedSlot } from "@/lib/timetable";
import type {
  ExceptionKind,
  FocusMode,
  ManualTaskKind,
  MealBlock,
  WeekParity,
} from "@/lib/types";

function revalidatePlanner() {
  for (const p of ["/", "/planner", "/planner/setup"]) revalidatePath(p);
}

// ---------- Settings ----------

export async function updatePlannerSettings(data: {
  wakeTime?: string;
  sleepHours?: number;
  preBufferMinutes?: number;
  travelMinutes?: number;
  focusMode?: FocusMode;
  minBlockMinutes?: number;
  maxBlockMinutes?: number;
  breakMinutes?: number;
  bufferPercent?: number;
  mealBlocks?: MealBlock[];
  gcalSyncClasses?: boolean;
}) {
  // Prisma's Json input type needs a widening cast; MealBlock[] is the shape.
  const meals = (data.mealBlocks ?? []) as unknown as Prisma.InputJsonValue;
  await prisma.plannerSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, mealBlocks: meals },
    update: {
      ...data,
      mealBlocks: data.mealBlocks ? meals : undefined,
    },
  });
  revalidatePlanner();
}

// ---------- Class slots ----------

export async function createClassSlot(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  location?: string;
  weekParity?: WeekParity;
  subjectId?: string;
}) {
  await prisma.classSlot.create({
    data: {
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      label: input.label.trim(),
      location: input.location?.trim() || null,
      weekParity: input.weekParity ?? "EVERY",
      subjectId: input.subjectId ?? null,
    },
  });
  revalidatePlanner();
}

export async function updateClassSlot(
  id: string,
  data: {
    startTime?: string;
    endTime?: string;
    label?: string;
    location?: string | null;
    weekParity?: WeekParity;
    active?: boolean;
    subjectId?: string | null;
  }
) {
  await prisma.classSlot.update({ where: { id }, data });
  revalidatePlanner();
}

export async function deleteClassSlot(id: string) {
  await prisma.classSlot.delete({ where: { id } });
  revalidatePlanner();
}

/** Parse pasted text and replace/append the timetable. Returns parse errors. */
export async function importTimetable(text: string, replaceAll: boolean) {
  const { slots, errors } = parseTimetable(text);
  if (slots.length === 0) return { imported: 0, errors };

  if (replaceAll) await prisma.classSlot.deleteMany();
  await prisma.classSlot.createMany({
    data: slots.map((s: ParsedSlot) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label,
      location: s.location ?? null,
      weekParity: s.weekParity,
    })),
  });
  revalidatePlanner();
  return { imported: slots.length, errors };
}

/** Copy every slot from one weekday onto another. */
export async function duplicateDay(fromDay: number, toDay: number) {
  if (fromDay === toDay) return { copied: 0 };
  const source = await prisma.classSlot.findMany({ where: { dayOfWeek: fromDay } });
  if (source.length === 0) return { copied: 0 };
  await prisma.classSlot.createMany({
    data: source.map((s) => ({
      dayOfWeek: toDay,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label,
      location: s.location,
      weekParity: s.weekParity,
      subjectId: s.subjectId,
      active: s.active,
    })),
  });
  revalidatePlanner();
  return { copied: source.length };
}

export async function clearDay(dayOfWeek: number) {
  await prisma.classSlot.deleteMany({ where: { dayOfWeek } });
  revalidatePlanner();
}

// ---------- Exceptions ----------

export async function createException(input: {
  date: string; // yyyy-MM-dd
  kind: ExceptionKind;
  label: string;
  startTime?: string;
  endTime?: string;
}) {
  await prisma.calendarException.create({
    data: {
      date: localDay(new Date(`${input.date}T00:00:00`)),
      kind: input.kind,
      label: input.label.trim(),
      startTime: input.startTime || null,
      endTime: input.endTime || null,
    },
  });
  revalidatePlanner();
}

export async function deleteException(id: string) {
  await prisma.calendarException.delete({ where: { id } });
  revalidatePlanner();
}

// ---------- Manual tasks ----------

export async function createManualTask(input: {
  title: string;
  estimateMins: number;
  kind: ManualTaskKind;
  priority: number;
  dueDate?: string;
}) {
  await prisma.manualTask.create({
    data: {
      title: input.title.trim(),
      estimateMins: input.estimateMins,
      kind: input.kind,
      priority: input.priority,
      dueDate: input.dueDate
        ? localDay(new Date(`${input.dueDate}T00:00:00`))
        : null,
    },
  });
  revalidatePlanner();
}

export async function setManualTaskDone(id: string, done: boolean) {
  await prisma.manualTask.update({ where: { id }, data: { done } });
  revalidatePlanner();
}

export async function deleteManualTask(id: string) {
  await prisma.manualTask.delete({ where: { id } });
  revalidatePlanner();
}

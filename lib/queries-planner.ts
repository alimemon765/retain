import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { FocusMode, MealBlock, WeekParity } from "./types";

export interface PlannerSettingsRow {
  wakeTime: string;
  sleepHours: number;
  preBufferMinutes: number;
  travelMinutes: number;
  focusMode: FocusMode;
  minBlockMinutes: number;
  maxBlockMinutes: number;
  breakMinutes: number;
  bufferPercent: number;
  mealBlocks: MealBlock[];
  gcalCalendarId: string | null;
  gcalConnected: boolean;
  gcalSyncClasses: boolean;
  gcalLastSyncAt: Date | null;
}

const DEFAULT_MEALS: MealBlock[] = [
  { label: "Lunch", start: "13:00", minutes: 45 },
  { label: "Dinner", start: "20:30", minutes: 45 },
];

/** Settings are a singleton row; created on first read with sane defaults. */
export async function getPlannerSettings(): Promise<PlannerSettingsRow> {
  const row = await prisma.plannerSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      mealBlocks: DEFAULT_MEALS as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });
  return {
    wakeTime: row.wakeTime,
    sleepHours: row.sleepHours,
    preBufferMinutes: row.preBufferMinutes,
    travelMinutes: row.travelMinutes,
    focusMode: row.focusMode as FocusMode,
    minBlockMinutes: row.minBlockMinutes,
    maxBlockMinutes: row.maxBlockMinutes,
    breakMinutes: row.breakMinutes,
    bufferPercent: row.bufferPercent,
    mealBlocks: (row.mealBlocks as unknown as MealBlock[]) ?? [],
    gcalCalendarId: row.gcalCalendarId,
    // Never leak the token itself to the client — only whether it exists.
    gcalConnected: Boolean(row.gcalRefreshToken),
    gcalSyncClasses: row.gcalSyncClasses,
    gcalLastSyncAt: row.gcalLastSyncAt,
  };
}

export interface ClassSlotRow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  subjectId: string | null;
  location: string | null;
  weekParity: WeekParity;
  active: boolean;
}

export async function getClassSlots(): Promise<ClassSlotRow[]> {
  const rows = await prisma.classSlot.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return rows.map((r) => ({ ...r, weekParity: r.weekParity as WeekParity }));
}

export interface PlannedBlockRow {
  id: string;
  startTime: string;
  endTime: string;
  kind: string;
  title: string;
  topicIds: string[];
  problemIds: string[];
  bookId: string | null;
  skillId: string | null;
  locked: boolean;
  completed: boolean;
  gcalEventId: string | null;
}

export async function getBlocksForDate(date: Date): Promise<PlannedBlockRow[]> {
  const rows = await prisma.plannedBlock.findMany({
    where: { date },
    orderBy: { startTime: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    startTime: r.startTime,
    endTime: r.endTime,
    kind: r.kind,
    title: r.title,
    topicIds: r.topicIds,
    problemIds: r.problemIds,
    bookId: r.bookId,
    skillId: r.skillId,
    locked: r.locked,
    completed: r.completed,
    gcalEventId: r.gcalEventId,
  }));
}

export async function getExceptions(from: Date, to: Date) {
  return prisma.calendarException.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
}

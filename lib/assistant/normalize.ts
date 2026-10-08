import type { AssistantTask, RawAssistantTask } from "./schema";

// Everything Claude returns passes through here before the scheduler sees it:
// values are clamped rather than trusted, bad dates are dropped with a note,
// and work too big for one block is split into sessions. Pure and immutable.

export const MAX_TASKS = 60;
const MAX_TITLE_CHARS = 120;
const MIN_ESTIMATE_MINS = 5;
/** No single flexible task gets more than a long day of work. */
const MAX_TASK_MINUTES = 12 * 60;
const MIN_PRIORITY = 1;
const MAX_PRIORITY = 5;
const DAY_MINUTES = 24 * 60;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface NormalizeContext {
  days: readonly string[];
  maxBlockMinutes: number;
}

type Draft = Omit<AssistantTask, "id">;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(Math.round(n), lo), hi);

function isRealDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_CHARS).trim();
}

function minutesFromMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function cleanOnDate(r: RawAssistantTask, title: string, ctx: NormalizeContext, notes: string[]) {
  if (r.onDate === null) return null;
  if (!isRealDate(r.onDate)) {
    notes.push(`Ignored the date "${r.onDate}" for "${title}".`);
    return null;
  }
  if (!ctx.days.includes(r.onDate)) {
    notes.push(`"${title}" was set for ${r.onDate}, outside these days, so it was left unpinned.`);
    return null;
  }
  return r.onDate;
}

function cleanDeadline(r: RawAssistantTask, title: string, ctx: NormalizeContext, notes: string[]) {
  if (r.deadline === null) return null;
  if (!isRealDate(r.deadline)) {
    notes.push(`Ignored the deadline "${r.deadline}" for "${title}".`);
    return null;
  }
  // Already past: it is due now, which is the first day we can plan.
  return r.deadline < ctx.days[0] ? ctx.days[0] : r.deadline;
}

function cleanFixedStart(r: RawAssistantTask, title: string, notes: string[]) {
  if (r.fixedStart === null) return null;
  if (!HH_MM.test(r.fixedStart)) {
    notes.push(`Ignored the time "${r.fixedStart}" for "${title}".`);
    return null;
  }
  return r.fixedStart;
}

/** Split work bigger than one block into evenly sized, numbered sessions. */
function splitIntoSessions(draft: Draft, maxBlock: number): Draft[] {
  if (draft.fixedStart !== null || draft.estimateMins <= maxBlock) return [draft];
  const parts = Math.ceil(draft.estimateMins / maxBlock);
  const base = Math.floor(draft.estimateMins / parts);
  const extra = draft.estimateMins - base * parts;
  return Array.from({ length: parts }, (_, i) => ({
    ...draft,
    title: `${draft.title} (${i + 1}/${parts})`,
    estimateMins: base + (i < extra ? 1 : 0),
  }));
}

function toDraft(r: RawAssistantTask, ctx: NormalizeContext, notes: string[]): Draft | null {
  const title = cleanTitle(r.title);
  if (!title) {
    notes.push("Skipped a task with no title.");
    return null;
  }
  const fixedStart = cleanFixedStart(r, title, notes);
  // A fixed appointment may run long, but never past midnight.
  const maxEstimate = fixedStart
    ? DAY_MINUTES - minutesFromMidnight(fixedStart)
    : MAX_TASK_MINUTES;
  if (r.estimateMins > maxEstimate) {
    notes.push(`"${title}" was capped at ${Math.round(maxEstimate / 60)}h.`);
  }
  return {
    title,
    kind: r.kind,
    estimateMins: clamp(r.estimateMins, MIN_ESTIMATE_MINS, maxEstimate),
    priority: clamp(r.priority, MIN_PRIORITY, MAX_PRIORITY),
    deadline: cleanDeadline(r, title, ctx, notes),
    onDate: cleanOnDate(r, title, ctx, notes),
    fixedStart,
    repeatDaily: r.repeatDaily,
  };
}

export function normalizeTasks(
  raw: readonly RawAssistantTask[],
  ctx: NormalizeContext
): { tasks: AssistantTask[]; notes: string[] } {
  const notes: string[] = [];
  if (raw.length > MAX_TASKS) {
    notes.push(`Only the first ${MAX_TASKS} tasks were kept.`);
  }

  const drafts = raw
    .slice(0, MAX_TASKS)
    .map((r) => toDraft(r, ctx, notes))
    .filter((d): d is Draft => d !== null)
    .flatMap((d) => splitIntoSessions(d, ctx.maxBlockMinutes));
  if (drafts.length > MAX_TASKS) {
    notes.push(`Only the first ${MAX_TASKS} sessions were kept.`);
  }

  const tasks = drafts.slice(0, MAX_TASKS).map((d, i) => ({ ...d, id: `t${i + 1}` }));
  return { tasks, notes };
}

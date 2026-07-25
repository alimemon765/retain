import { countPatterns, patternCapReached } from "./practice";
import { fromMinutes, toMinutes } from "./timetable";
import type {
  BlockKind,
  Demand,
  FocusMode,
  MealBlock,
  WeekParity,
} from "./types";

// Pure day scheduler. No DB, no framework imports — everything it needs comes
// in through `generatePlan`'s argument so the whole thing is unit testable.
//
// All internal arithmetic is minutes-from-local-midnight; the caller supplies
// the date only for weekday, week parity and exception matching.

const DAY_MINUTES = 24 * 60;
/** Post-lunch dip is clock-anchored, not wake-anchored. */
const DIP_START = 13 * 60;
const DIP_END = 15 * 60;
const SECOND_PEAK_START = 16 * 60;
const SECOND_PEAK_END = 20 * 60;
const INERTIA_MINUTES = 60;
const MORNING_PEAK_START = 60;
const MORNING_PEAK_END = 300;
const WIND_DOWN_MINUTES = 60;
/** A clipped fixed block thinner than this is noise — drop it instead. */
const MIN_FIXED_SLIVER = 5;
/** Batched SM-2 reviews, per topic. */
export const MINUTES_PER_REVIEW = 4;

export interface PlannerConfig {
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
}

export interface PlannerClassSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  location?: string | null;
  weekParity: WeekParity;
  active: boolean;
}

export interface PlannerException {
  kind: "HOLIDAY" | "NO_COLLEGE" | "CUSTOM_BUSY" | "EXAM";
  label: string;
  startTime?: string | null;
  endTime?: string | null;
}

export type CandidateSource =
  | "REVIEW_OVERDUE"
  | "REVIEW_DUE"
  | "DSA_RESOLVE_OVERDUE"
  | "DSA_RESOLVE_DUE"
  | "DSA_NEW"
  | "MANUAL"
  | "SKILL_ACTION"
  | "READING";

export interface Candidate {
  id: string;
  source: CandidateSource;
  kind: Extract<BlockKind, "REVISION" | "DSA" | "READING" | "SKILL" | "CUSTOM">;
  title: string;
  estimateMins: number;
  demand: Demand;
  daysOverdue?: number;
  daysToExam?: number | null;
  /** 1 (highest) .. 5 — manual tasks only. */
  priority?: number;
  patterns?: string[];
  topicId?: string;
  problemId?: string;
  bookId?: string;
  skillId?: string;
}

export interface PlannerBlock {
  startTime: string;
  endTime: string;
  kind: BlockKind;
  title: string;
  topicIds: string[];
  problemIds: string[];
  bookId?: string;
  skillId?: string;
  locked: boolean;
  completed?: boolean;
  /** Set for blocks carried through from the existing (locked) plan. */
  existingId?: string;
}

export interface PlanSummary {
  minutesByKind: Record<string, number>;
  freeMinutes: number;
  scheduledMinutes: number;
  /** All BUFFER-kind time: deliberate slack plus any unclaimed work slots. */
  bufferMinutes: number;
  /** Only the slack the planner reserved on purpose (breaks + buffer share). */
  reservedSlackMinutes: number;
  overflow: Candidate[];
  warnings: string[];
}

export interface GeneratePlanInput {
  date: Date;
  settings: PlannerConfig;
  classSlots: PlannerClassSlot[];
  exceptions: PlannerException[];
  candidates: Candidate[];
  lockedBlocks: PlannerBlock[];
}

interface Span {
  start: number;
  end: number;
}

interface FixedSpan extends Span {
  kind: BlockKind;
  title: string;
  locked: boolean;
  existingId?: string;
}

// ---------- base weights & multipliers ----------

const BASE_WEIGHT: Record<CandidateSource, number> = {
  REVIEW_OVERDUE: 10,
  REVIEW_DUE: 8,
  DSA_RESOLVE_OVERDUE: 7,
  DSA_RESOLVE_DUE: 6,
  DSA_NEW: 5,
  MANUAL: 6, // refined by priority below
  SKILL_ACTION: 4,
  READING: 3,
};

const FOCUS_TARGET: Record<FocusMode, BlockKind | null> = {
  BALANCED: null,
  EXAMS: "REVISION",
  CP: "DSA",
  READING: "READING",
  SKILLS: "SKILL",
};

export function baseWeight(c: Candidate): number {
  if (c.source === "MANUAL") {
    // priority 1 → 8 … priority 5 → 4
    const p = Math.min(Math.max(c.priority ?? 3, 1), 5);
    return 9 - p;
  }
  return BASE_WEIGHT[c.source];
}

export function focusMultiplier(kind: BlockKind, mode: FocusMode): number {
  const target = FOCUS_TARGET[mode];
  if (target === null) return 1;
  return kind === target ? 1.8 : 0.8;
}

export function urgencyMultiplier(daysOverdue = 0): number {
  return Math.min(1 + Math.max(daysOverdue, 0) * 0.15, 2.5);
}

export function examProximityMultiplier(daysToExam?: number | null): number {
  if (daysToExam == null || daysToExam < 0 || daysToExam > 21) return 1;
  return 1 + (21 - daysToExam) / 21;
}

export function scoreCandidate(c: Candidate, mode: FocusMode): number {
  return (
    baseWeight(c) *
    focusMultiplier(c.kind, mode) *
    urgencyMultiplier(c.daysOverdue) *
    examProximityMultiplier(c.daysToExam)
  );
}

// ---------- alertness ----------

export type Alertness = "PEAK" | "MODERATE" | "LOW" | "WIND_DOWN";

/**
 * Alertness at a moment, relative to wake/bed. Precedence matters: wind-down
 * wins (it protects sleep onset) and the post-lunch dip beats the morning peak
 * for late risers, because the dip is circadian rather than time-since-waking.
 */
export function alertnessAt(
  minute: number,
  wakeMin: number,
  bedMin: number
): Alertness {
  const sinceWake = minute - wakeMin;
  if (minute >= bedMin - WIND_DOWN_MINUTES && minute < bedMin) return "WIND_DOWN";
  if (minute >= DIP_START && minute < DIP_END) return "LOW";
  if (sinceWake >= 0 && sinceWake < INERTIA_MINUTES) return "LOW";
  if (sinceWake >= MORNING_PEAK_START && sinceWake < MORNING_PEAK_END) return "PEAK";
  if (minute >= SECOND_PEAK_START && minute < SECOND_PEAK_END) return "PEAK";
  return "MODERATE";
}

/** Higher is a better match. 0 means "allowed but poor"; -1 means forbidden. */
export function demandFit(
  demand: Demand,
  kind: BlockKind,
  alertness: Alertness
): number {
  switch (alertness) {
    case "WIND_DOWN":
      // Light revision before sleep aids consolidation; hard work hurts sleep onset.
      if (demand === "HIGH") return -1;
      if (kind === "REVISION") return 3;
      return demand === "LOW" ? 2 : -1;
    case "PEAK":
      return demand === "HIGH" ? 3 : demand === "MEDIUM" ? 2 : 1;
    case "LOW":
      return demand === "LOW" ? 3 : demand === "MEDIUM" ? 2 : 0;
    case "MODERATE":
      return demand === "MEDIUM" ? 3 : demand === "HIGH" ? 2 : 2;
  }
}

// ---------- week parity ----------

/** ISO week number — drives ODD/EVEN alternating timetables. */
export function isoWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function parityMatches(parity: WeekParity, date: Date): boolean {
  if (parity === "EVERY") return true;
  const odd = isoWeekNumber(date) % 2 === 1;
  return parity === "ODD" ? odd : !odd;
}

// ---------- span helpers ----------

function subtract(span: Span, occupied: Span[]): Span[] {
  let pieces: Span[] = [span];
  for (const o of occupied) {
    const next: Span[] = [];
    for (const p of pieces) {
      if (o.end <= p.start || o.start >= p.end) {
        next.push(p);
        continue;
      }
      if (o.start > p.start) next.push({ start: p.start, end: o.start });
      if (o.end < p.end) next.push({ start: o.end, end: p.end });
    }
    pieces = next;
  }
  return pieces.filter((p) => p.end > p.start);
}

/** How far a meal may slide from its preferred time before we give up. */
const MEAL_SEARCH_HORIZON = 180;

/**
 * First gap of `duration` at or after `preferred` that is clear of `occupied`,
 * searching forward only (eating early is worse than eating a bit late).
 */
function findMealWindow(
  preferred: number,
  duration: number,
  occupied: Span[]
): number | null {
  const sorted = [...occupied].sort((a, b) => a.start - b.start);
  let cursor = preferred;
  const limit = Math.min(preferred + MEAL_SEARCH_HORIZON, DAY_MINUTES - duration);
  while (cursor <= limit) {
    const clash = sorted.find((o) => o.start < cursor + duration && cursor < o.end);
    if (!clash) return cursor;
    cursor = clash.end;
  }
  return null;
}

// ---------- stage 1: fixed blocks ----------

function buildFixedSpans(input: GeneratePlanInput): {
  fixed: FixedSpan[];
  warnings: string[];
} {
  const { date, settings, classSlots, exceptions, lockedBlocks } = input;
  const warnings: string[] = [];
  const wake = toMinutes(settings.wakeTime);
  const sleepMins = Math.round(settings.sleepHours * 60);
  const bed = (wake - sleepMins + DAY_MINUTES) % DAY_MINUTES;

  const noCollege = exceptions.some(
    (e) => e.kind === "HOLIDAY" || e.kind === "NO_COLLEGE"
  );
  const busy = exceptions.filter(
    (e) => e.kind === "CUSTOM_BUSY" || e.kind === "EXAM"
  );

  // Candidate fixed spans in descending priority. Later entries are clipped
  // against everything already placed, so the output can never overlap.
  const proposed: FixedSpan[] = [];

  // 1. Locked blocks — an explicit instruction from me outranks generated ones.
  for (const b of lockedBlocks) {
    proposed.push({
      start: toMinutes(b.startTime),
      end: toMinutes(b.endTime),
      kind: b.kind,
      title: b.title,
      locked: true,
      existingId: b.existingId,
    });
  }

  // 2. Exception busy windows (exams, one-off commitments).
  for (const e of busy) {
    proposed.push({
      start: e.startTime ? toMinutes(e.startTime) : 0,
      end: e.endTime ? toMinutes(e.endTime) : DAY_MINUTES,
      kind: "CUSTOM",
      title: e.label,
      locked: false,
    });
  }

  // 3. Classes — externally fixed.
  const todaysClasses = noCollege
    ? []
    : classSlots
        .filter(
          (c) =>
            c.active &&
            c.dayOfWeek === date.getDay() &&
            parityMatches(c.weekParity, date)
        )
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  for (const c of todaysClasses) {
    proposed.push({
      start: toMinutes(c.startTime),
      end: toMinutes(c.endTime),
      kind: "CLASS",
      title: c.location ? `${c.label} · ${c.location}` : c.label,
      locked: false,
    });
  }

  // 4. Sleep — two spans because the day boundary cuts the night in half.
  if (bed < wake) {
    proposed.push({ start: 0, end: wake, kind: "SLEEP", title: "Sleep", locked: false });
    proposed.push({ start: bed, end: wake, kind: "SLEEP", title: "Sleep", locked: false });
  } else {
    proposed.push({ start: 0, end: wake, kind: "SLEEP", title: "Sleep", locked: false });
    proposed.push({ start: bed, end: DAY_MINUTES, kind: "SLEEP", title: "Sleep", locked: false });
  }

  // 5. Travel, only when there is actually a class to travel to.
  if (todaysClasses.length > 0 && settings.travelMinutes > 0) {
    const first = toMinutes(todaysClasses[0].startTime);
    const last = toMinutes(todaysClasses[todaysClasses.length - 1].endTime);
    proposed.push({
      start: Math.max(first - settings.travelMinutes, 0),
      end: first,
      kind: "TRAVEL",
      title: "Travel to college",
      locked: false,
    });
    proposed.push({
      start: last,
      end: Math.min(last + settings.travelMinutes, DAY_MINUTES),
      kind: "TRAVEL",
      title: "Travel home",
      locked: false,
    });
  }

  // 6. Get ready.
  if (settings.preBufferMinutes > 0) {
    proposed.push({
      start: wake,
      end: Math.min(wake + settings.preBufferMinutes, DAY_MINUTES),
      kind: "GET_READY",
      title: "Get ready",
      locked: false,
    });
  }

  // Resolve collisions by clipping each span against everything already kept.
  const fixed: FixedSpan[] = [];
  const occupied: Span[] = [];
  for (const p of proposed) {
    if (p.end <= p.start) continue;
    const pieces = subtract(p, occupied).filter(
      (s) => s.end - s.start >= MIN_FIXED_SLIVER
    );
    if (pieces.length === 0) {
      if (p.kind === "GET_READY") {
        warnings.push(`${p.title} dropped — it collides with a fixed commitment.`);
      }
      continue;
    }
    for (const piece of pieces) {
      fixed.push({ ...p, start: piece.start, end: piece.end });
      occupied.push(piece);
    }
    occupied.sort((a, b) => a.start - b.start);
  }

  // Meals last, and they slide rather than vanish: a lunch that collides with
  // the commute is eaten when you get home, not skipped.
  for (const m of settings.mealBlocks) {
    const preferred = toMinutes(m.start);
    const placed = findMealWindow(preferred, m.minutes, occupied);
    if (placed === null) {
      warnings.push(`No room for ${m.label} today.`);
      continue;
    }
    fixed.push({
      start: placed,
      end: placed + m.minutes,
      kind: "MEAL",
      title: placed === preferred ? m.label : `${m.label} (moved)`,
      locked: false,
    });
    occupied.push({ start: placed, end: placed + m.minutes });
    occupied.sort((a, b) => a.start - b.start);
  }

  if (settings.sleepHours < 6.5) {
    warnings.push(
      `Only ${settings.sleepHours}h of sleep scheduled — that is below what actually sustains focus.`
    );
  }

  return { fixed: fixed.sort((a, b) => a.start - b.start), warnings };
}

// ---------- stage 2: carve free time ----------

interface WorkSlot extends Span {
  remaining: number;
  assigned: Candidate[];
  patternCounts: Map<string, number>;
}

function carveFreeTime(
  free: Span[],
  settings: PlannerConfig
): { slots: WorkSlot[]; slack: Span[] } {
  const slots: WorkSlot[] = [];
  const slack: Span[] = [];

  for (const stretch of free) {
    const duration = stretch.end - stretch.start;
    // Scraps are rest, not work — fragmenting attention across them is worse
    // than leaving them empty.
    if (duration < settings.minBlockMinutes) {
      slack.push(stretch);
      continue;
    }

    // Slack is taken proportionally from every stretch so it ends up spread
    // through the day rather than dumped in one lump at the end.
    const reserve = Math.round((duration * settings.bufferPercent) / 100);
    const usableEnd = stretch.end - reserve;

    let cursor = stretch.start;
    while (usableEnd - cursor >= settings.minBlockMinutes) {
      const len = Math.min(settings.maxBlockMinutes, usableEnd - cursor);
      slots.push({
        start: cursor,
        end: cursor + len,
        remaining: len,
        assigned: [],
        patternCounts: new Map(),
      });
      cursor += len;
      const roomForMore =
        usableEnd - cursor >= settings.minBlockMinutes + settings.breakMinutes;
      if (roomForMore && settings.breakMinutes > 0) {
        slack.push({ start: cursor, end: cursor + settings.breakMinutes });
        cursor += settings.breakMinutes;
      } else {
        break;
      }
    }
    if (cursor < stretch.end) slack.push({ start: cursor, end: stretch.end });
  }

  return { slots, slack };
}

// ---------- stage 4: placement ----------

function batchReviews(candidates: Candidate[], maxBlockMinutes: number): Candidate[] {
  const reviews = candidates.filter((c) => c.kind === "REVISION");
  if (reviews.length === 0) return candidates;
  const others = candidates.filter((c) => c.kind !== "REVISION");

  // Reviews are short; context-switching costs more than the tasks themselves,
  // so they travel as one batch (chunked only when a batch outgrows a block).
  const perChunk = Math.max(1, Math.floor(maxBlockMinutes / MINUTES_PER_REVIEW));
  const chunks: Candidate[] = [];
  for (let i = 0; i < reviews.length; i += perChunk) {
    const group = reviews.slice(i, i + perChunk);
    const overdue = Math.max(...group.map((g) => g.daysOverdue ?? 0));
    const exam = group
      .map((g) => g.daysToExam)
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b)[0];
    chunks.push({
      id: `reviews-${i / perChunk}`,
      source: group.some((g) => g.source === "REVIEW_OVERDUE")
        ? "REVIEW_OVERDUE"
        : "REVIEW_DUE",
      kind: "REVISION",
      title:
        group.length === 1
          ? group[0].title
          : `Revise ${group.length} topics`,
      estimateMins: group.length * MINUTES_PER_REVIEW,
      demand: "MEDIUM",
      daysOverdue: overdue,
      daysToExam: exam ?? null,
      topicId: undefined,
      patterns: [],
      // Carry every topic id so the block deep-links to exactly this set.
      ...{ topicIds: group.map((g) => g.topicId).filter(Boolean) },
    } as Candidate & { topicIds: string[] });
  }
  return [...chunks, ...others];
}

function placeCandidates(
  slots: WorkSlot[],
  candidates: Candidate[],
  settings: PlannerConfig,
  wakeMin: number,
  bedMin: number
): { overflow: Candidate[] } {
  const overflow: Candidate[] = [];

  // Reviews first, then everything else by score. Spaced repetition is the
  // spine of the app — it is never the thing that gets dropped.
  const reviews = candidates.filter((c) => c.kind === "REVISION");
  const rest = candidates
    .filter((c) => c.kind !== "REVISION")
    .sort(
      (a, b) =>
        scoreCandidate(b, settings.focusMode) -
        scoreCandidate(a, settings.focusMode)
    );

  for (const c of [...reviews, ...rest]) {
    let best: WorkSlot | null = null;
    let bestFit = -Infinity;

    for (const slot of slots) {
      if (slot.remaining < c.estimateMins) continue;
      // Never split one DSA problem across two blocks, and never let a block
      // stack up on a single pattern.
      if (
        c.kind === "DSA" &&
        c.patterns?.length &&
        patternCapReached(c.patterns, slot.patternCounts)
      ) {
        continue;
      }
      const alertness = alertnessAt(slot.start, wakeMin, bedMin);
      const fit = demandFit(c.demand, c.kind, alertness);
      if (fit < 0) continue;
      // Prefer better alertness fit; break ties toward earlier in the day.
      if (fit > bestFit) {
        bestFit = fit;
        best = slot;
      }
    }

    if (!best) {
      overflow.push(c);
      continue;
    }
    best.assigned.push(c);
    best.remaining -= c.estimateMins;
    if (c.patterns?.length) countPatterns(c.patterns, best.patternCounts);
  }

  return { overflow };
}

// ---------- entry point ----------

export function generatePlan(input: GeneratePlanInput): {
  blocks: PlannerBlock[];
  summary: PlanSummary;
} {
  const { settings } = input;
  const wakeMin = toMinutes(settings.wakeTime);
  const bedMin =
    (wakeMin - Math.round(settings.sleepHours * 60) + DAY_MINUTES) % DAY_MINUTES;

  const { fixed, warnings } = buildFixedSpans(input);

  const free = subtract({ start: 0, end: DAY_MINUTES }, fixed);
  const freeMinutes = free.reduce((n, s) => n + (s.end - s.start), 0);

  const { slots, slack } = carveFreeTime(free, settings);

  const prepared = batchReviews(input.candidates, settings.maxBlockMinutes);
  const { overflow } = placeCandidates(slots, prepared, settings, wakeMin, bedMin);

  if (overflow.some((c) => c.kind === "REVISION")) {
    warnings.push(
      "Reviews do not fit in today's free time — consider a lighter focus mode or fewer new topics."
    );
  }

  // Assemble output blocks.
  const blocks: PlannerBlock[] = [];

  for (const f of fixed) {
    blocks.push({
      startTime: fromMinutes(f.start),
      endTime: fromMinutes(f.end),
      kind: f.kind,
      title: f.title,
      topicIds: [],
      problemIds: [],
      locked: f.locked,
      existingId: f.existingId,
    });
  }

  for (const slot of slots) {
    if (slot.assigned.length === 0) {
      // An empty work slot is just unclaimed time — label it honestly.
      blocks.push({
        startTime: fromMinutes(slot.start),
        endTime: fromMinutes(slot.end),
        kind: "BUFFER",
        title: "Free",
        topicIds: [],
        problemIds: [],
        locked: false,
      });
      continue;
    }
    const used = slot.assigned.reduce((n, c) => n + c.estimateMins, 0);
    const kind = slot.assigned[0].kind;
    const title =
      slot.assigned.length === 1
        ? slot.assigned[0].title
        : `${slot.assigned.length} × ${kind.toLowerCase()}`;
    blocks.push({
      startTime: fromMinutes(slot.start),
      endTime: fromMinutes(slot.start + Math.max(used, settings.minBlockMinutes)),
      kind,
      title,
      topicIds: slot.assigned.flatMap(
        (c) => (c as Candidate & { topicIds?: string[] }).topicIds ?? (c.topicId ? [c.topicId] : [])
      ),
      problemIds: slot.assigned.flatMap((c) => (c.problemId ? [c.problemId] : [])),
      bookId: slot.assigned.find((c) => c.bookId)?.bookId,
      skillId: slot.assigned.find((c) => c.skillId)?.skillId,
      locked: false,
    });
  }

  for (const s of slack) {
    blocks.push({
      startTime: fromMinutes(s.start),
      endTime: fromMinutes(s.end),
      kind: "BUFFER",
      title: "Buffer",
      topicIds: [],
      problemIds: [],
      locked: false,
    });
  }

  blocks.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const minutesByKind: Record<string, number> = {};
  for (const b of blocks) {
    const mins = toMinutes(b.endTime) - toMinutes(b.startTime);
    minutesByKind[b.kind] = (minutesByKind[b.kind] ?? 0) + mins;
  }
  const bufferMinutes = minutesByKind.BUFFER ?? 0;
  const reservedSlackMinutes = slack.reduce((n, s) => n + (s.end - s.start), 0);
  const scheduledMinutes = slots.reduce(
    (n, s) => n + s.assigned.reduce((m, c) => m + c.estimateMins, 0),
    0
  );

  return {
    blocks,
    summary: {
      minutesByKind,
      freeMinutes,
      scheduledMinutes,
      bufferMinutes,
      reservedSlackMinutes,
      overflow,
      warnings,
    },
  };
}

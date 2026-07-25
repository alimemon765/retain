import type { WeekParity } from "./types";

// Bulk-paste timetable parser. Typing a whole timetable is the single most
// likely reason the planner gets abandoned before first use, so this accepts
// messy real-world input rather than one rigid format.

export interface ParsedSlot {
  dayOfWeek: number;
  startTime: string; // HH:mm
  endTime: string;
  label: string;
  location?: string;
  weekParity: WeekParity;
}

export interface ParseLineError {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  slots: ParsedSlot[];
  errors: ParseLineError[];
}

const DAY_ALIASES: Record<string, number> = {
  sun: 0, sunday: 0, su: 0,
  mon: 1, monday: 1, mo: 1, m: 1,
  tue: 2, tues: 2, tuesday: 2, tu: 2,
  wed: 3, weds: 3, wednesday: 3, we: 3, w: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4,
  fri: 5, friday: 5, fr: 5, f: 5,
  sat: 6, saturday: 6, sa: 6,
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "?";
}

/**
 * Normalize one time token to HH:mm. Accepts "9", "9:00", "09.00", "9am",
 * "2:30pm", "1400". Returns null if it can't be read as a time.
 */
export function parseTime(raw: string): string | null {
  let s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  let meridiem: "am" | "pm" | null = null;
  const mer = s.match(/(am|pm)$/);
  if (mer) {
    meridiem = mer[1] as "am" | "pm";
    s = s.slice(0, -2);
  }

  s = s.replace(/[.\-]/g, ":");

  let hours: number;
  let minutes: number;

  if (s.includes(":")) {
    const [h, m = "0"] = s.split(":");
    hours = Number(h);
    minutes = Number(m);
  } else if (/^\d{3,4}$/.test(s)) {
    // military style: 900 / 1400
    hours = Number(s.slice(0, s.length - 2));
    minutes = Number(s.slice(-2));
  } else if (/^\d{1,2}$/.test(s)) {
    hours = Number(s);
    minutes = 0;
  } else {
    return null;
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Minutes since local midnight for an HH:mm string. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(total, 24 * 60));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Parse lines like:
 *   Mon 09:00-10:00 DAA Lecture
 *   tuesday 9-10.30 FLAT lab @ Room 204
 *   Wed 2pm - 3:30pm DMM (odd weeks)
 * Blank lines and lines starting with # are skipped.
 */
export function parseTimetable(input: string): ParseResult {
  const slots: ParsedSlot[] = [];
  const errors: ParseLineError[] = [];

  input.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const fail = (reason: string) =>
      errors.push({ line: i + 1, text: line, reason });

    // Day is the first token.
    const dayMatch = line.match(/^([a-zA-Z]+)\b[\s,:-]*(.*)$/);
    if (!dayMatch) return fail("no day found");
    const day = DAY_ALIASES[dayMatch[1].toLowerCase()];
    if (day === undefined) return fail(`unknown day "${dayMatch[1]}"`);

    let rest = dayMatch[2].trim();
    if (!rest) return fail("nothing after the day");

    // Week parity marker anywhere in the line.
    let weekParity: WeekParity = "EVERY";
    const parity = rest.match(/\((odd|even)[^)]*\)/i);
    if (parity) {
      weekParity = parity[1].toLowerCase() === "odd" ? "ODD" : "EVEN";
      rest = rest.replace(parity[0], " ").trim();
    }

    // Time range: two times separated by - or – or "to".
    const range = rest.match(
      /^(\d{1,2}(?::|\.)?\d{0,2}\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::|\.)?\d{0,2}\s*(?:am|pm)?)\s*(.*)$/i
    );
    if (!range) return fail("no start-end time range");

    const start = parseTime(range[1]);
    const end = parseTime(range[2]);
    if (!start) return fail(`bad start time "${range[1].trim()}"`);
    if (!end) return fail(`bad end time "${range[2].trim()}"`);
    if (toMinutes(end) <= toMinutes(start)) {
      return fail("end time is not after start time");
    }

    let label = range[3].trim().replace(/^[-–—:,]\s*/, "");
    let location: string | undefined;
    const at = label.match(/\s*@\s*(.+)$/);
    if (at) {
      location = at[1].trim();
      label = label.slice(0, at.index).trim();
    }
    if (!label) return fail("no class name");

    slots.push({ dayOfWeek: day, startTime: start, endTime: end, label, location, weekParity });
  });

  return { slots, errors };
}

/** True when two [start,end) HH:mm ranges overlap. */
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

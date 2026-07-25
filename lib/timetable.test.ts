import { describe, expect, it } from "vitest";
import {
  fromMinutes,
  overlaps,
  parseTime,
  parseTimetable,
  toMinutes,
} from "./timetable";

describe("parseTime", () => {
  it("reads the common formats", () => {
    expect(parseTime("09:00")).toBe("09:00");
    expect(parseTime("9:00")).toBe("09:00");
    expect(parseTime("9")).toBe("09:00");
    expect(parseTime("09.30")).toBe("09:30");
    expect(parseTime("1400")).toBe("14:00");
    expect(parseTime("930")).toBe("09:30");
  });

  it("handles am/pm including noon and midnight", () => {
    expect(parseTime("9am")).toBe("09:00");
    expect(parseTime("2pm")).toBe("14:00");
    expect(parseTime("2:30pm")).toBe("14:30");
    expect(parseTime("12pm")).toBe("12:00");
    expect(parseTime("12am")).toBe("00:00");
    expect(parseTime(" 3 PM ")).toBe("15:00");
  });

  it("rejects nonsense", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("10:75")).toBeNull();
  });
});

describe("parseTimetable", () => {
  it("parses a clean timetable", () => {
    const { slots, errors } = parseTimetable(
      ["Mon 09:00-10:00 DAA Lecture", "Tue 11:00-13:00 FLAT Lab"].join("\n")
    );
    expect(errors).toEqual([]);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      label: "DAA Lecture",
      weekParity: "EVERY",
    });
    expect(slots[1].dayOfWeek).toBe(2);
  });

  it("survives messy real-world input", () => {
    const { slots, errors } = parseTimetable(
      [
        "monday 9-10.30  DAA Lecture",
        "TUES 2pm - 3:30pm DMM",
        "wed 11:00 to 12:00 FLAT",
        "  ",
        "# a comment",
        "Thu 09:00-10:00 IT Lab @ Room 204",
        "fri 10-11 DBMS (odd weeks)",
      ].join("\n")
    );
    expect(errors).toEqual([]);
    expect(slots).toHaveLength(5);
    expect(slots[0]).toMatchObject({ startTime: "09:00", endTime: "10:30" });
    expect(slots[1]).toMatchObject({ dayOfWeek: 2, startTime: "14:00", endTime: "15:30" });
    expect(slots[2]).toMatchObject({ dayOfWeek: 3, endTime: "12:00" });
    expect(slots[3]).toMatchObject({ label: "IT Lab", location: "Room 204" });
    expect(slots[4]).toMatchObject({ label: "DBMS", weekParity: "ODD" });
  });

  it("reports per-line errors without dropping good lines", () => {
    const { slots, errors } = parseTimetable(
      [
        "Mon 09:00-10:00 DAA",
        "Blursday 09:00-10:00 Nope",
        "Tue 10:00 Missing end",
        "Wed 11:00-10:00 Backwards",
        "Thu 09:00-10:00",
      ].join("\n")
    );
    expect(slots).toHaveLength(1);
    expect(errors).toHaveLength(4);
    expect(errors[0].reason).toContain("unknown day");
    expect(errors[1].reason).toContain("time range");
    expect(errors[2].reason).toContain("not after");
    expect(errors[3].reason).toContain("no class name");
  });

  it("returns empty for empty input", () => {
    expect(parseTimetable("")).toEqual({ slots: [], errors: [] });
  });
});

describe("time helpers", () => {
  it("round-trips minutes", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(0)).toBe("00:00");
  });

  it("detects overlap on half-open ranges", () => {
    expect(overlaps("09:00", "10:00", "09:30", "10:30")).toBe(true);
    expect(overlaps("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(overlaps("09:00", "12:00", "10:00", "11:00")).toBe(true);
  });
});

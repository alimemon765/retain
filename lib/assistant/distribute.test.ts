import { describe, expect, it } from "vitest";
import { distributeTasks, type DayCapacity } from "./distribute";
import type { AssistantTask } from "./schema";

const D1 = "2026-10-08";
const D2 = "2026-10-09";
const D3 = "2026-10-10";

function days(...caps: number[]): DayCapacity[] {
  return [D1, D2, D3].slice(0, caps.length).map((iso, i) => ({
    iso,
    capacityMins: caps[i],
  }));
}

function task(id: string, over: Partial<AssistantTask> = {}): AssistantTask {
  return {
    id,
    title: id,
    kind: "STUDY",
    estimateMins: 60,
    priority: 3,
    deadline: null,
    onDate: null,
    fixedStart: null,
    repeatDaily: false,
    ...over,
  };
}

const dayOf = (r: ReturnType<typeof distributeTasks>, taskId: string) =>
  r.assignments.filter((a) => a.taskId === taskId).map((a) => a.iso);

describe("distributeTasks", () => {
  it("puts a pinned task on exactly its day", () => {
    // Arrange
    const tasks = [task("dentist-prep", { onDate: D3 })];

    // Act
    const result = distributeTasks(tasks, days(300, 300, 300));

    // Assert
    expect(dayOf(result, "dentist-prep")).toEqual([D3]);
  });

  it("lands a deadline task on or before its deadline, as early as it fits", () => {
    const result = distributeTasks(
      [task("report", { deadline: D2 })],
      days(300, 300, 300)
    );
    expect(dayOf(result, "report")).toEqual([D1]);
  });

  it("never schedules a deadline task after its deadline", () => {
    // Day 1 is already full, so the only legal slot is day 2.
    const result = distributeTasks(
      [task("filler", { onDate: D1, estimateMins: 120 }), task("report", { deadline: D2 })],
      days(120, 300, 300)
    );
    expect(dayOf(result, "report")).toEqual([D2]);
  });

  it("spreads unpinned work toward the least loaded day", () => {
    const result = distributeTasks(
      [task("a"), task("b"), task("c")],
      days(120, 120, 120)
    );
    const used = new Set(result.assignments.map((a) => a.iso));
    expect(used.size).toBe(3);
  });

  it("places higher-priority work first when time is scarce", () => {
    const result = distributeTasks(
      [task("low", { priority: 5 }), task("urgent", { priority: 1 })],
      days(60)
    );
    expect(dayOf(result, "urgent")).toEqual([D1]);
    expect(result.overflow.map((o) => o.taskId)).toEqual(["low"]);
  });

  it("expands a daily task into one instance per day", () => {
    const result = distributeTasks(
      [task("gym", { repeatDaily: true, fixedStart: "18:00" })],
      days(300, 300, 300)
    );
    expect(dayOf(result, "gym")).toEqual([D1, D2, D3]);
    const ids = result.assignments.map((a) => a.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts a fixed-time item with no date on the first day and counts its time", () => {
    const result = distributeTasks(
      [task("call", { fixedStart: "16:00", estimateMins: 60 }), task("study", { estimateMins: 60 })],
      days(60, 60)
    );
    expect(dayOf(result, "call")).toEqual([D1]);
    // Day 1's hour is taken by the call, so the study session moves.
    expect(dayOf(result, "study")).toEqual([D2]);
  });

  it("reports work that cannot fit anywhere", () => {
    const result = distributeTasks([task("huge", { estimateMins: 90 })], days(30, 30));
    expect(result.assignments).toEqual([]);
    expect(result.overflow[0]).toMatchObject({ taskId: "huge" });
    expect(result.overflow[0].reason).toMatch(/room/);
  });

  it("explains when a deadline cannot be met", () => {
    const result = distributeTasks(
      [task("report", { deadline: D1, estimateMins: 90 })],
      days(30, 300)
    );
    expect(result.overflow[0].reason).toMatch(/deadline/);
  });

  it("does not mutate its inputs", () => {
    const tasks = Object.freeze([Object.freeze(task("a"))]);
    const caps = Object.freeze(days(300).map((d) => Object.freeze(d)));
    expect(() => distributeTasks(tasks, caps)).not.toThrow();
    expect(caps[0].capacityMins).toBe(300);
  });
});

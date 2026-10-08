import { describe, expect, it } from "vitest";
import { normalizeTasks } from "./normalize";
import type { RawAssistantTask } from "./schema";

const DAYS = ["2026-10-08", "2026-10-09", "2026-10-10"];
const CTX = { days: DAYS, maxBlockMinutes: 90 };

function raw(over: Partial<RawAssistantTask> = {}): RawAssistantTask {
  return {
    title: "Revise graphs",
    kind: "STUDY",
    estimateMins: 45,
    priority: 3,
    deadline: null,
    onDate: null,
    fixedStart: null,
    repeatDaily: false,
    ...over,
  };
}

describe("normalizeTasks", () => {
  it("assigns stable ids and keeps a well-formed task intact", () => {
    // Arrange
    const input = [raw()];

    // Act
    const { tasks, notes } = normalizeTasks(input, CTX);

    // Assert
    expect(notes).toEqual([]);
    expect(tasks).toEqual([{ ...raw(), id: "t1" }]);
  });

  it("clamps priority and estimate into their legal ranges", () => {
    const { tasks } = normalizeTasks(
      [raw({ priority: 9, estimateMins: 2 }), raw({ priority: -3 })],
      CTX
    );
    expect(tasks[0].priority).toBe(5);
    expect(tasks[0].estimateMins).toBe(5);
    expect(tasks[1].priority).toBe(1);
  });

  it("splits work longer than one block into numbered sessions", () => {
    // The scheduler can never place a task bigger than its largest block.
    const { tasks } = normalizeTasks(
      [raw({ title: "Assignment", estimateMins: 200 })],
      CTX
    );
    expect(tasks.map((t) => t.title)).toEqual([
      "Assignment (1/3)",
      "Assignment (2/3)",
      "Assignment (3/3)",
    ]);
    expect(tasks.every((t) => t.estimateMins <= 90)).toBe(true);
    expect(tasks.reduce((n, t) => n + t.estimateMins, 0)).toBe(200);
  });

  it("does not split a fixed-time appointment", () => {
    const { tasks } = normalizeTasks(
      [raw({ title: "Exam", estimateMins: 180, fixedStart: "10:00" })],
      CTX
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].estimateMins).toBe(180);
  });

  it("drops a pinned date outside the planning window and says so", () => {
    const { tasks, notes } = normalizeTasks(
      [raw({ title: "Dentist", onDate: "2026-12-01" })],
      CTX
    );
    expect(tasks[0].onDate).toBeNull();
    expect(notes.join(" ")).toMatch(/Dentist/);
  });

  it("treats an already-passed deadline as due on the first day", () => {
    const { tasks } = normalizeTasks([raw({ deadline: "2026-10-01" })], CTX);
    expect(tasks[0].deadline).toBe("2026-10-08");
  });

  it("rejects malformed dates and times instead of trusting them", () => {
    const { tasks, notes } = normalizeTasks(
      [
        raw({ onDate: "2026-02-30" }),
        raw({ deadline: "next friday" }),
        raw({ fixedStart: "25:61" }),
      ],
      CTX
    );
    expect(tasks[0].onDate).toBeNull();
    expect(tasks[1].deadline).toBeNull();
    expect(tasks[2].fixedStart).toBeNull();
    expect(notes).toHaveLength(3);
  });

  it("keeps a fixed appointment inside the day", () => {
    const { tasks } = normalizeTasks(
      [raw({ fixedStart: "23:30", estimateMins: 120 })],
      CTX
    );
    expect(tasks[0].estimateMins).toBe(30);
  });

  it("drops tasks with no usable title", () => {
    const { tasks, notes } = normalizeTasks([raw({ title: "   " })], CTX);
    expect(tasks).toEqual([]);
    expect(notes).toHaveLength(1);
  });

  it("trims and caps very long titles", () => {
    const { tasks } = normalizeTasks(
      [raw({ title: `  ${"x".repeat(300)}  ` })],
      CTX
    );
    expect(tasks[0].title.length).toBeLessThanOrEqual(120);
  });

  it("caps the number of tasks it will accept", () => {
    const many = Array.from({ length: 80 }, (_, i) => raw({ title: `Task ${i}` }));
    const { tasks, notes } = normalizeTasks(many, CTX);
    expect(tasks).toHaveLength(60);
    expect(notes.join(" ")).toMatch(/60/);
  });

  it("does not mutate its input", () => {
    const input = Object.freeze([Object.freeze(raw({ estimateMins: 200 }))]);
    expect(() => normalizeTasks(input, CTX)).not.toThrow();
    expect(input[0].estimateMins).toBe(200);
  });
});

describe("normalizeTasks — abuse limits", () => {
  // Regression: an unbounded estimate split into millions of sessions.
  it("caps an absurd estimate instead of exploding into sessions", () => {
    const { tasks, notes } = normalizeTasks([raw({ estimateMins: 1e9 })], CTX);
    expect(tasks.length).toBeLessThanOrEqual(60);
    expect(tasks.reduce((n, t) => n + t.estimateMins, 0)).toBeLessThanOrEqual(12 * 60);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("caps the total number of sessions after splitting", () => {
    const many = Array.from({ length: 60 }, (_, i) => raw({ title: `Big ${i}`, estimateMins: 200 }));
    const { tasks } = normalizeTasks(many, CTX);
    expect(tasks.length).toBeLessThanOrEqual(60);
  });
});

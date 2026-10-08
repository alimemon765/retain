import { describe, expect, it } from "vitest";
import { excludePlaced, taskIdsPlacedOnOtherDays, toManualCandidate } from "./candidates";
import type { Candidate } from "./planner";

function c(over: Partial<Candidate> & Pick<Candidate, "id">): Candidate {
  return {
    source: "DSA_NEW",
    kind: "DSA",
    title: over.id,
    estimateMins: 30,
    demand: "HIGH",
    ...over,
  } as Candidate;
}

const placed = (over: Partial<Parameters<typeof excludePlaced>[1][number]>) => ({
  topicIds: [],
  problemIds: [],
  taskIds: [],
  bookId: null,
  skillId: null,
  ...over,
});

describe("excludePlaced", () => {
  // Regression: re-optimizing a day used to duplicate work that a locked
  // block already covered, so the same skill appeared twice in one day.
  it("drops candidates a locked block already covers", () => {
    const candidates = [
      c({ id: "skill:react", kind: "SKILL", skillId: "react" }),
      c({ id: "topic:a", kind: "REVISION", topicId: "a" }),
      c({ id: "problem:x", problemId: "x" }),
      c({ id: "task:t1", kind: "CUSTOM", taskId: "t1" }),
      c({ id: "book:b1", kind: "READING", bookId: "b1" }),
    ];
    const kept = excludePlaced(candidates, [
      placed({ skillId: "react" }),
      placed({ topicIds: ["a"] }),
      placed({ problemIds: ["x"] }),
      placed({ taskIds: ["t1"] }),
      placed({ bookId: "b1" }),
    ]);
    expect(kept).toHaveLength(0);
  });

  it("keeps candidates that are not placed yet", () => {
    const candidates = [
      c({ id: "skill:react", kind: "SKILL", skillId: "react" }),
      c({ id: "skill:docker", kind: "SKILL", skillId: "docker" }),
    ];
    const kept = excludePlaced(candidates, [placed({ skillId: "react" })]);
    expect(kept.map((k) => k.id)).toEqual(["skill:docker"]);
  });

  it("is a no-op when nothing is placed", () => {
    const candidates = [c({ id: "a" }), c({ id: "b" })];
    expect(excludePlaced(candidates, [])).toHaveLength(2);
  });
});

describe("taskIdsPlacedOnOtherDays", () => {
  const rows = [
    { iso: "2026-10-07", taskIds: ["old"] },
    { iso: "2026-10-08", taskIds: ["today-task"] },
    { iso: "2026-10-09", taskIds: ["fri-a", "fri-b"] },
  ];

  it("collects tasks placed on other upcoming days", () => {
    // Re-optimizing Thursday must not pull in work already given to Friday.
    const ids = taskIdsPlacedOnOtherDays(rows, "2026-10-08", "2026-10-08");
    expect([...ids].sort()).toEqual(["fri-a", "fri-b"]);
  });

  it("ignores past days so unfinished work can roll forward", () => {
    const ids = taskIdsPlacedOnOtherDays(rows, "2026-10-09", "2026-10-08");
    expect(ids.has("old")).toBe(false);
    expect(ids.has("today-task")).toBe(true);
  });
});

describe("toManualCandidate", () => {
  it("maps a task onto the scheduler's categories", () => {
    const c = toManualCandidate({
      id: "abc",
      title: "Lab report",
      kind: "STUDY",
      estimateMins: 50,
      priority: 1,
      dueDate: null,
    }, new Date("2026-10-08T00:00:00"));
    expect(c).toMatchObject({
      id: "task:abc",
      source: "MANUAL",
      kind: "REVISION",
      demand: "MEDIUM",
      estimateMins: 50,
      priority: 1,
      taskId: "abc",
      daysOverdue: 0,
    });
  });

  it("counts days past a due date as overdue", () => {
    const c = toManualCandidate({
      id: "late",
      title: "Form",
      kind: "ADMIN",
      estimateMins: 15,
      priority: 3,
      dueDate: new Date("2026-10-05T00:00:00"),
    }, new Date("2026-10-08T00:00:00"));
    expect(c.daysOverdue).toBe(3);
    expect(c.kind).toBe("CUSTOM");
  });
});

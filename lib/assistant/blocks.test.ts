import { describe, expect, it } from "vitest";
import {
  assignmentCandidate,
  clampDayCount,
  fixedBlock,
  planningWindow,
  remapTaskIds,
} from "./blocks";
import type { Assignment } from "./distribute";
import type { AssistantTask } from "./schema";

function assignment(over: Partial<AssistantTask> = {}, iso = "2026-10-09"): Assignment {
  const task: AssistantTask = {
    id: "t1",
    title: "Lab report",
    kind: "STUDY",
    estimateMins: 50,
    priority: 2,
    deadline: null,
    onDate: null,
    fixedStart: null,
    repeatDaily: false,
    ...over,
  };
  return { instanceId: task.id, taskId: task.id, iso, task };
}

describe("planningWindow", () => {
  it("lists consecutive days from the start date", () => {
    expect(planningWindow("2026-10-30", 4)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("clampDayCount", () => {
  it("keeps the window between one day and a week", () => {
    expect(clampDayCount(0)).toBe(1);
    expect(clampDayCount(3)).toBe(3);
    expect(clampDayCount(30)).toBe(7);
    expect(clampDayCount(Number.NaN)).toBe(3);
  });
});

describe("fixedBlock", () => {
  it("turns a timed item into a locked block at that time", () => {
    const block = fixedBlock(assignment({ title: "Dentist", fixedStart: "16:00", estimateMins: 45 }));
    expect(block).toMatchObject({
      startTime: "16:00",
      endTime: "16:45",
      title: "Dentist",
      locked: true,
      kind: "CUSTOM",
    });
  });

  it("never runs past midnight", () => {
    const block = fixedBlock(assignment({ fixedStart: "23:30", estimateMins: 90 }));
    expect(block.endTime).toBe("24:00");
  });
});

describe("assignmentCandidate", () => {
  it("schedules a flexible task under its instance id", () => {
    const c = assignmentCandidate(assignment({ deadline: "2026-10-10" }));
    expect(c).toMatchObject({ taskId: "t1", kind: "REVISION", estimateMins: 50, priority: 2 });
  });
});

describe("remapTaskIds", () => {
  it("swaps draft ids for saved ids without touching the input", () => {
    const blocks = Object.freeze([
      Object.freeze({ title: "a", taskIds: Object.freeze(["t1@x", "t2"]) }),
      Object.freeze({ title: "b", taskIds: Object.freeze([]) }),
    ]);
    const out = remapTaskIds(blocks, new Map([["t1@x", "db-1"], ["t2", "db-2"]]));
    expect(out.map((b) => b.taskIds)).toEqual([["db-1", "db-2"], []]);
    expect(blocks[0].taskIds).toEqual(["t1@x", "t2"]);
  });

  it("drops ids it cannot map rather than saving a dangling reference", () => {
    const out = remapTaskIds([{ taskIds: ["ghost"] }], new Map());
    expect(out[0].taskIds).toEqual([]);
  });
});

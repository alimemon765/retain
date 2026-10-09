import { describe, expect, it } from "vitest";
import { assistantBlockMarker } from "./replace";
import type { Assignment } from "./distribute";
import type { AssistantTask } from "./schema";

const TASK: AssistantTask = {
  id: "t1",
  title: "Gym",
  kind: "ADMIN",
  estimateMins: 60,
  priority: 3,
  deadline: null,
  onDate: null,
  fixedStart: "18:00",
  repeatDaily: false,
};

const assignment = (task: AssistantTask): Assignment => ({
  instanceId: task.id,
  taskId: task.id,
  iso: "2026-10-09",
  task,
});

const block = (over: Partial<{ startTime: string; title: string; taskIds: string[]; existingId: string }>) => ({
  startTime: "09:00",
  title: "Something",
  taskIds: [] as string[],
  existingId: undefined as string | undefined,
  ...over,
});

describe("assistantBlockMarker", () => {
  it("marks a new block that holds one of the newly saved tasks", () => {
    const isAssistant = assistantBlockMarker([], new Set(["db1"]));
    expect(isAssistant(block({ taskIds: ["db1"] }))).toBe(true);
  });

  it("marks the locked block made for a fixed-time task", () => {
    const isAssistant = assistantBlockMarker([assignment(TASK)], new Set());
    expect(isAssistant(block({ startTime: "18:00", title: "Gym" }))).toBe(true);
  });

  it("leaves the user's own blocks and reviews unmarked", () => {
    const isAssistant = assistantBlockMarker([assignment(TASK)], new Set(["db1"]));
    expect(isAssistant(block({ title: "Revise 2 topics" }))).toBe(false);
    expect(isAssistant(block({ taskIds: ["mine"] }))).toBe(false);
  });

  it("never re-marks a block that already existed", () => {
    const isAssistant = assistantBlockMarker([assignment(TASK)], new Set(["db1"]));
    expect(
      isAssistant(block({ startTime: "18:00", title: "Gym", existingId: "old" }))
    ).toBe(false);
  });
});

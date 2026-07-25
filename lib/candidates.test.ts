import { describe, expect, it } from "vitest";
import { excludePlaced } from "./candidates";
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

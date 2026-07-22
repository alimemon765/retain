import { describe, expect, it } from "vitest";
import { buildPracticeSet, type PracticeCandidate } from "./practice";

const today = new Date("2026-07-23T00:00:00");
const d = (offset: number) =>
  new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);

function candidate(
  id: string,
  patterns: string[],
  nextReview: Date
): PracticeCandidate {
  return { id, title: id, patterns, nextReview };
}

describe("buildPracticeSet", () => {
  it("never takes more than 2 problems from one pattern", () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      candidate(`dp${i}`, ["Dynamic Programming"], d(-i))
    );
    const set = buildPracticeSet({
      candidates,
      patternAccuracy: new Map([["Dynamic Programming", 20]]),
      today,
    });
    expect(set.length).toBe(2);
  });

  it("prefers weaker patterns", () => {
    const candidates = [
      candidate("strong", ["Two Pointers"], d(0)),
      candidate("weak", ["Dynamic Programming"], d(0)),
    ];
    const set = buildPracticeSet({
      candidates,
      patternAccuracy: new Map([
        ["Two Pointers", 90],
        ["Dynamic Programming", 30],
      ]),
      today,
      size: 1,
    });
    expect(set[0].id).toBe("weak");
  });

  it("prefers overdue problems, all else equal", () => {
    const candidates = [
      candidate("fresh", ["BFS"], d(5)),
      candidate("overdue", ["DFS"], d(-10)),
    ];
    const set = buildPracticeSet({
      candidates,
      patternAccuracy: new Map([
        ["BFS", 50],
        ["DFS", 50],
      ]),
      today,
      size: 1,
    });
    expect(set[0].id).toBe("overdue");
  });

  it("mixes patterns up to the requested size", () => {
    const candidates = [
      candidate("a1", ["Sliding Window"], d(-3)),
      candidate("a2", ["Sliding Window"], d(-2)),
      candidate("a3", ["Sliding Window"], d(-1)),
      candidate("b1", ["Greedy"], d(0)),
      candidate("c1", ["Trie"], d(0)),
      candidate("d1", ["Intervals"], d(0)),
    ];
    const set = buildPracticeSet({
      candidates,
      patternAccuracy: new Map([["Sliding Window", 10]]),
      today,
    });
    expect(set.length).toBe(5);
    const sw = set.filter((p) => p.patterns.includes("Sliding Window"));
    expect(sw.length).toBe(2); // capped despite being weakest
  });

  it("returns fewer than size when candidates run out", () => {
    const set = buildPracticeSet({
      candidates: [candidate("only", ["BFS"], d(0))],
      patternAccuracy: new Map(),
      today,
    });
    expect(set.length).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  alertnessAt,
  demandFit,
  examProximityMultiplier,
  focusMultiplier,
  generatePlan,
  isoWeekNumber,
  scoreCandidate,
  urgencyMultiplier,
  type Candidate,
  type GeneratePlanInput,
  type PlannerClassSlot,
  type PlannerConfig,
} from "./planner";
import { toMinutes } from "./timetable";

const SETTINGS: PlannerConfig = {
  wakeTime: "06:30",
  sleepHours: 7.5,
  preBufferMinutes: 60,
  travelMinutes: 60,
  focusMode: "BALANCED",
  minBlockMinutes: 25,
  maxBlockMinutes: 90,
  breakMinutes: 10,
  bufferPercent: 20,
  mealBlocks: [
    { label: "Lunch", start: "13:00", minutes: 45 },
    { label: "Dinner", start: "20:30", minutes: 45 },
  ],
};

// A Thursday.
const THURSDAY = new Date("2026-07-23T00:00:00");

const CLASSES: PlannerClassSlot[] = [
  {
    dayOfWeek: 4,
    startTime: "09:00",
    endTime: "13:00",
    label: "Lectures",
    weekParity: "EVERY",
    active: true,
  },
];

function candidate(over: Partial<Candidate> & Pick<Candidate, "id">): Candidate {
  return {
    source: "DSA_NEW",
    kind: "DSA",
    title: over.id,
    estimateMins: 30,
    demand: "HIGH",
    ...over,
  } as Candidate;
}

function run(over: Partial<GeneratePlanInput> = {}) {
  return generatePlan({
    date: THURSDAY,
    settings: SETTINGS,
    classSlots: CLASSES,
    exceptions: [],
    candidates: [],
    lockedBlocks: [],
    ...over,
  });
}

const minutes = (b: { startTime: string; endTime: string }) =>
  toMinutes(b.endTime) - toMinutes(b.startTime);

describe("fixed blocks", () => {
  it("never overlap", () => {
    const { blocks } = run();
    const sorted = [...blocks].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(toMinutes(sorted[i].startTime)).toBeGreaterThanOrEqual(
        toMinutes(sorted[i - 1].endTime)
      );
    }
  });

  it("cover the whole day with no gaps", () => {
    // Run with candidates: an under-filled work slot used to leave a hole.
    const { blocks } = run({
      candidates: [
        candidate({ id: "short", estimateMins: 20, patterns: ["dp"] }),
        candidate({
          id: "rev",
          source: "REVIEW_DUE",
          kind: "REVISION",
          demand: "MEDIUM",
          estimateMins: 8,
          topicId: "t1",
        }),
      ],
    });
    const sorted = [...blocks].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
    );
    expect(toMinutes(sorted[0].startTime)).toBe(0);
    expect(toMinutes(sorted[sorted.length - 1].endTime)).toBe(24 * 60);
    for (let i = 1; i < sorted.length; i++) {
      expect(toMinutes(sorted[i].startTime)).toBe(toMinutes(sorted[i - 1].endTime));
    }
  });

  it("never mixes two kinds of work into one block", () => {
    const { blocks } = run({
      classSlots: [],
      candidates: [
        candidate({
          id: "rev",
          source: "REVIEW_DUE",
          kind: "REVISION",
          demand: "MEDIUM",
          estimateMins: 8,
          topicId: "t1",
        }),
        candidate({ id: "dsa", estimateMins: 20, patterns: ["dp"] }),
        candidate({
          id: "book",
          source: "READING",
          kind: "READING",
          demand: "LOW",
          estimateMins: 30,
          bookId: "b1",
        }),
      ],
    });
    // A revision block carries topics only; a DSA block carries problems only.
    for (const b of blocks.filter((x) => x.kind === "REVISION")) {
      expect(b.problemIds).toHaveLength(0);
    }
    for (const b of blocks.filter((x) => x.kind === "DSA")) {
      expect(b.topicIds).toHaveLength(0);
    }
  });

  it("schedules sleep for the configured hours", () => {
    const { summary } = run();
    expect(summary.minutesByKind.SLEEP).toBe(7.5 * 60);
  });

  it("places travel either side of the class day", () => {
    const { blocks } = run();
    const travel = blocks.filter((b) => b.kind === "TRAVEL");
    expect(travel).toHaveLength(2);
    expect(travel[0].endTime).toBe("09:00"); // arrives for the first class
    expect(travel[1].startTime).toBe("13:00"); // leaves after the last
  });

  it("skips travel entirely on a day with no classes", () => {
    const { blocks } = run({ classSlots: [] });
    expect(blocks.filter((b) => b.kind === "TRAVEL")).toHaveLength(0);
  });

  it("drops classes on a holiday", () => {
    const { blocks } = run({
      exceptions: [{ kind: "HOLIDAY", label: "Diwali" }],
    });
    expect(blocks.filter((b) => b.kind === "CLASS")).toHaveLength(0);
    expect(blocks.filter((b) => b.kind === "TRAVEL")).toHaveLength(0);
  });

  it("blocks out an exam window", () => {
    const { blocks } = run({
      exceptions: [
        { kind: "EXAM", label: "DAA exam", startTime: "14:00", endTime: "17:00" },
      ],
    });
    const exam = blocks.find((b) => b.title === "DAA exam");
    expect(exam).toBeDefined();
    expect(exam!.startTime).toBe("14:00");
    expect(exam!.endTime).toBe("17:00");
  });

  it("respects alternating-week timetables", () => {
    const oddOnly: PlannerClassSlot[] = [
      { ...CLASSES[0], weekParity: "ODD", label: "Odd week lecture" },
    ];
    const week = isoWeekNumber(THURSDAY);
    const { blocks } = run({ classSlots: oddOnly });
    const hasClass = blocks.some((b) => b.kind === "CLASS");
    expect(hasClass).toBe(week % 2 === 1);
  });
});

describe("locked blocks", () => {
  it("survive regeneration unchanged", () => {
    const { blocks } = run({
      lockedBlocks: [
        {
          startTime: "17:00",
          endTime: "18:30",
          kind: "CUSTOM",
          title: "Gym",
          topicIds: [],
          problemIds: [],
          taskIds: [],
          locked: true,
          existingId: "gym-1",
        },
      ],
    });
    const gym = blocks.find((b) => b.title === "Gym");
    expect(gym).toMatchObject({
      startTime: "17:00",
      endTime: "18:30",
      locked: true,
      existingId: "gym-1",
    });
  });

  it("push generated work out of their way", () => {
    const locked = {
      startTime: "17:00",
      endTime: "18:30",
      kind: "CUSTOM" as const,
      title: "Gym",
      topicIds: [],
      problemIds: [],
      taskIds: [],
      locked: true,
    };
    const { blocks } = run({
      lockedBlocks: [locked],
      candidates: Array.from({ length: 6 }, (_, i) =>
        candidate({ id: `p${i}`, patterns: [`pattern-${i}`] })
      ),
    });
    const work = blocks.filter((b) => b.kind === "DSA");
    for (const w of work) {
      const overlaps =
        toMinutes(w.startTime) < toMinutes("18:30") &&
        toMinutes("17:00") < toMinutes(w.endTime);
      expect(overlaps).toBe(false);
    }
  });
});

describe("free time", () => {
  it("a day with no classes yields more free time", () => {
    const withClasses = run().summary.freeMinutes;
    const without = run({ classSlots: [] }).summary.freeMinutes;
    expect(without).toBeGreaterThan(withClasses);
  });

  it("respects the buffer percentage", () => {
    const { summary } = run({ classSlots: [] });
    // Deliberate slack (reserve + breaks) tracks the configured share; it runs
    // a little over because breaks between blocks are slack too.
    const ratio = summary.reservedSlackMinutes / summary.freeMinutes;
    expect(ratio).toBeGreaterThanOrEqual(SETTINGS.bufferPercent / 100);
    expect(ratio).toBeLessThan(0.45);
  });

  it("scales slack with the setting", () => {
    const low = run({
      classSlots: [],
      settings: { ...SETTINGS, bufferPercent: 5 },
    }).summary.reservedSlackMinutes;
    const high = run({
      classSlots: [],
      settings: { ...SETTINGS, bufferPercent: 40 },
    }).summary.reservedSlackMinutes;
    expect(high).toBeGreaterThan(low);
  });

  it("never emits a work block longer than maxBlockMinutes", () => {
    const { blocks } = run({
      classSlots: [],
      candidates: Array.from({ length: 20 }, (_, i) =>
        candidate({ id: `p${i}`, estimateMins: 45, patterns: [`pat-${i}`] })
      ),
    });
    for (const b of blocks.filter((x) => x.kind === "DSA")) {
      expect(minutes(b)).toBeLessThanOrEqual(SETTINGS.maxBlockMinutes);
    }
  });
});

describe("scoring", () => {
  it("weights overdue reviews above everything else", () => {
    const overdueReview = candidate({
      id: "r",
      source: "REVIEW_OVERDUE",
      kind: "REVISION",
      demand: "MEDIUM",
      daysOverdue: 3,
    });
    const reading = candidate({
      id: "b",
      source: "READING",
      kind: "READING",
      demand: "LOW",
    });
    expect(scoreCandidate(overdueReview, "BALANCED")).toBeGreaterThan(
      scoreCandidate(reading, "BALANCED")
    );
  });

  it("focus mode boosts its own category and damps the others", () => {
    expect(focusMultiplier("DSA", "CP")).toBe(1.8);
    expect(focusMultiplier("REVISION", "CP")).toBe(0.8);
    expect(focusMultiplier("DSA", "BALANCED")).toBe(1);
  });

  it("urgency grows with overdue days and caps at 2.5", () => {
    expect(urgencyMultiplier(0)).toBe(1);
    expect(urgencyMultiplier(2)).toBeCloseTo(1.3);
    expect(urgencyMultiplier(100)).toBe(2.5);
  });

  it("exam proximity only applies inside 21 days", () => {
    expect(examProximityMultiplier(null)).toBe(1);
    expect(examProximityMultiplier(30)).toBe(1);
    expect(examProximityMultiplier(21)).toBe(1);
    expect(examProximityMultiplier(0)).toBe(2);
  });

  it("shifts category minutes in the expected direction", () => {
    const pool: Candidate[] = [
      ...Array.from({ length: 4 }, (_, i) =>
        candidate({ id: `d${i}`, kind: "DSA", source: "DSA_NEW", patterns: [`p${i}`] })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        candidate({
          id: `b${i}`,
          kind: "READING",
          source: "READING",
          demand: "LOW",
          bookId: "book1",
        })
      ),
    ];
    const cp = run({
      classSlots: [],
      candidates: pool,
      settings: { ...SETTINGS, focusMode: "CP" },
    }).summary.minutesByKind;
    const reading = run({
      classSlots: [],
      candidates: pool,
      settings: { ...SETTINGS, focusMode: "READING" },
    }).summary.minutesByKind;

    expect(cp.DSA ?? 0).toBeGreaterThanOrEqual(reading.DSA ?? 0);
    expect(reading.READING ?? 0).toBeGreaterThanOrEqual(cp.READING ?? 0);
  });
});

describe("placement", () => {
  it("puts HIGH-demand work in a peak window, not the post-lunch dip", () => {
    const { blocks } = run({
      classSlots: [],
      candidates: [candidate({ id: "hard", demand: "HIGH", patterns: ["dp"] })],
    });
    const work = blocks.find((b) => b.kind === "DSA");
    expect(work).toBeDefined();
    const start = toMinutes(work!.startTime);
    const inDip = start >= toMinutes("13:00") && start < toMinutes("15:00");
    expect(inDip).toBe(false);
    expect(alertnessAt(start, toMinutes("06:30"), toMinutes("23:00"))).toBe("PEAK");
  });

  it("never puts HIGH-demand work in the wind-down hour", () => {
    const { blocks } = run({
      classSlots: [],
      candidates: Array.from({ length: 14 }, (_, i) =>
        candidate({ id: `h${i}`, demand: "HIGH", patterns: [`pat${i}`] })
      ),
    });
    const windDownStart = toMinutes("22:00");
    for (const b of blocks.filter((x) => x.kind === "DSA")) {
      expect(toMinutes(b.startTime)).toBeLessThan(windDownStart);
    }
  });

  it("batches reviews into a single block", () => {
    const reviews = Array.from({ length: 6 }, (_, i) =>
      candidate({
        id: `t${i}`,
        source: "REVIEW_DUE",
        kind: "REVISION",
        demand: "MEDIUM",
        estimateMins: 4,
        topicId: `topic-${i}`,
      })
    );
    const { blocks } = run({ candidates: reviews });
    const revision = blocks.filter((b) => b.kind === "REVISION");
    expect(revision).toHaveLength(1);
    expect(revision[0].topicIds).toHaveLength(6);
  });

  it("keeps more than two problems of one pattern out of the same block", () => {
    const { blocks } = run({
      classSlots: [],
      candidates: Array.from({ length: 5 }, (_, i) =>
        candidate({ id: `dp${i}`, estimateMins: 20, patterns: ["Dynamic Programming"] })
      ),
    });
    for (const b of blocks.filter((x) => x.kind === "DSA")) {
      expect(b.problemIds.length).toBeLessThanOrEqual(2);
    }
  });

  it("drops other categories before reviews when time is short", () => {
    const manyReviews = Array.from({ length: 30 }, (_, i) =>
      candidate({
        id: `t${i}`,
        source: "REVIEW_OVERDUE",
        kind: "REVISION",
        demand: "MEDIUM",
        estimateMins: 4,
        topicId: `topic-${i}`,
        daysOverdue: 2,
      })
    );
    const bulkyDsa = Array.from({ length: 10 }, (_, i) =>
      candidate({ id: `d${i}`, estimateMins: 90, patterns: [`p${i}`] })
    );
    const { summary } = run({
      candidates: [...manyReviews, ...bulkyDsa],
    });
    expect(summary.overflow.length).toBeGreaterThan(0);
    // Whatever spilled, it is not the spaced-repetition work.
    expect(summary.overflow.every((c) => c.kind !== "REVISION")).toBe(true);
  });

  it("reports what did not fit", () => {
    const { summary } = run({
      candidates: Array.from({ length: 40 }, (_, i) =>
        candidate({ id: `d${i}`, estimateMins: 90, patterns: [`p${i}`] })
      ),
    });
    expect(summary.overflow.length).toBeGreaterThan(0);
  });
});

describe("alertness model", () => {
  const wake = toMinutes("06:30");
  const bed = toMinutes("23:00");

  it("maps the day the way the research says", () => {
    expect(alertnessAt(toMinutes("07:00"), wake, bed)).toBe("LOW"); // inertia
    expect(alertnessAt(toMinutes("09:00"), wake, bed)).toBe("PEAK");
    expect(alertnessAt(toMinutes("13:30"), wake, bed)).toBe("LOW"); // dip
    expect(alertnessAt(toMinutes("17:00"), wake, bed)).toBe("PEAK");
    expect(alertnessAt(toMinutes("21:00"), wake, bed)).toBe("MODERATE");
    expect(alertnessAt(toMinutes("22:30"), wake, bed)).toBe("WIND_DOWN");
  });

  it("forbids hard work at wind-down but allows light revision", () => {
    expect(demandFit("HIGH", "DSA", "WIND_DOWN")).toBeLessThan(0);
    expect(demandFit("MEDIUM", "REVISION", "WIND_DOWN")).toBeGreaterThan(0);
    expect(demandFit("LOW", "READING", "WIND_DOWN")).toBeGreaterThan(0);
  });

  it("prefers HIGH at peak and LOW in the dip", () => {
    expect(demandFit("HIGH", "DSA", "PEAK")).toBeGreaterThan(
      demandFit("HIGH", "DSA", "LOW")
    );
    expect(demandFit("LOW", "READING", "LOW")).toBeGreaterThan(
      demandFit("HIGH", "DSA", "LOW")
    );
  });
});

describe("warnings", () => {
  it("flags short sleep", () => {
    const { summary } = run({ settings: { ...SETTINGS, sleepHours: 5 } });
    expect(summary.warnings.some((w) => w.includes("below what actually"))).toBe(true);
  });

  it("stays quiet on a healthy day", () => {
    const { summary } = run();
    expect(summary.warnings).toEqual([]);
  });

  it("slides a meal that collides with the commute instead of skipping it", () => {
    // Classes end 13:00, travel home runs to 14:00, lunch wants 13:00.
    const { blocks, summary } = run();
    const lunch = blocks.find((b) => b.title.startsWith("Lunch"));
    expect(lunch).toBeDefined();
    expect(lunch!.title).toContain("moved");
    expect(lunch!.startTime).toBe("14:00");
    expect(summary.warnings).toEqual([]);
  });
});

describe("study tasks vs spaced-repetition reviews", () => {
  // Regression: a 90-minute study task (kind REVISION) used to be swallowed
  // into the 4-minute review batch — renamed, shrunk, and unlinked from its task.
  it("keeps a manual study task as its own block with its full time and task link", () => {
    const { blocks } = run({
      classSlots: [],
      candidates: [
        candidate({
          id: "task:t1",
          source: "MANUAL",
          kind: "REVISION",
          demand: "MEDIUM",
          title: "Finish DAA assignment",
          estimateMins: 90,
          taskId: "t1",
        }),
      ],
    });
    const block = blocks.find((b) => b.taskIds.includes("t1"));
    expect(block).toBeDefined();
    expect(block!.title).toBe("Finish DAA assignment");
    expect(minutes(block!)).toBe(90);
  });

  it("still batches real SM-2 reviews together", () => {
    const reviews = [1, 2, 3].map((i) =>
      candidate({
        id: `topic:${i}`,
        source: "REVIEW_DUE",
        kind: "REVISION",
        demand: "MEDIUM",
        estimateMins: 4,
        topicId: `topic-${i}`,
      })
    );
    const study = candidate({
      id: "task:s",
      source: "MANUAL",
      kind: "REVISION",
      demand: "MEDIUM",
      estimateMins: 60,
      taskId: "s",
    });
    const { blocks } = run({ classSlots: [], candidates: [...reviews, study] });
    const batch = blocks.find((b) => b.topicIds.length === 3);
    expect(batch).toBeDefined();
    expect(batch!.taskIds).toEqual([]);
  });

  it("never drops a review before a study task when time is short", () => {
    const review = candidate({
      id: "topic:1",
      source: "REVIEW_OVERDUE",
      kind: "REVISION",
      demand: "MEDIUM",
      estimateMins: 4,
      topicId: "topic-1",
      daysOverdue: 3,
    });
    const study = candidate({
      id: "task:big",
      source: "MANUAL",
      kind: "REVISION",
      demand: "MEDIUM",
      estimateMins: 90,
      taskId: "big",
    });
    const { summary } = run({ candidates: [study, review] });
    expect(summary.overflow.some((c) => c.id === "topic:1")).toBe(false);
  });
});

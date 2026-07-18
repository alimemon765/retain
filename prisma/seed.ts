import { PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";

const prisma = new PrismaClient();

const day = (offset: number) => startOfDay(addDays(new Date(), offset));

async function main() {
  await prisma.review.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subject.deleteMany();

  const daa = await prisma.subject.create({
    data: { name: "DAA", color: "#e0704a" },
  });
  const flat = await prisma.subject.create({
    data: { name: "FLAT", color: "#5aa7d6" },
  });

  // Fresh topic studied today — first review tomorrow.
  await prisma.topic.create({
    data: {
      subjectId: daa.id,
      name: "Merge sort & recurrence analysis",
      source: "COLLEGE",
      dateStudied: day(0),
      nextReview: day(1),
      questions: {
        create: [
          {
            text: "State the recurrence for merge sort and solve it.",
            answer: "T(n) = 2T(n/2) + O(n) → O(n log n)",
          },
          { text: "Why is merge sort stable?" },
        ],
      },
    },
  });

  // Due today (overdue by 0) — one successful review behind it.
  await prisma.topic.create({
    data: {
      subjectId: daa.id,
      name: "Quick sort partition schemes",
      source: "COLLEGE",
      dateStudied: day(-4),
      easeFactor: 2.5,
      intervalDays: 3,
      repetitions: 1,
      nextReview: day(0),
      status: "REVIEWING",
      questions: {
        create: [
          {
            text: "Worst case of quick sort and when it happens?",
            answer: "O(n²), already-sorted input with naive pivot",
          },
        ],
      },
    },
  });

  // Overdue by 2 days.
  await prisma.topic.create({
    data: {
      subjectId: flat.id,
      name: "DFA vs NFA equivalence",
      source: "COLLEGE",
      dateStudied: day(-6),
      easeFactor: 2.36,
      intervalDays: 3,
      repetitions: 2,
      nextReview: day(-2),
      status: "REVIEWING",
    },
  });

  // Mid-cycle, due in 4 days.
  await prisma.topic.create({
    data: {
      subjectId: flat.id,
      name: "Pumping lemma for regular languages",
      source: "SELF",
      notes: "Sipser §1.4. Remember: works only to prove NON-regularity.",
      dateStudied: day(-10),
      easeFactor: 2.6,
      intervalDays: 7,
      repetitions: 3,
      nextReview: day(4),
      status: "REVIEWING",
    },
  });

  // Mastered, far out.
  await prisma.topic.create({
    data: {
      subjectId: daa.id,
      name: "Asymptotic notation basics",
      source: "SELF",
      dateStudied: day(-120),
      easeFactor: 2.8,
      intervalDays: 90,
      repetitions: 7,
      nextReview: day(45),
      status: "MASTERED",
    },
  });

  console.log("Seeded 2 subjects, 5 topics.");
}

main().finally(() => prisma.$disconnect());

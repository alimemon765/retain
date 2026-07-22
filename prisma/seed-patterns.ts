import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Standard DSA pattern taxonomy. Idempotent: safe to re-run.
const PATTERNS = [
  "Two Pointers",
  "Sliding Window",
  "Fast & Slow Pointers",
  "Binary Search",
  "BFS",
  "DFS",
  "Backtracking",
  "Dynamic Programming",
  "Greedy",
  "Heap / Top-K",
  "Monotonic Stack",
  "Union Find",
  "Trie",
  "Bit Manipulation",
  "Intervals",
  "Prefix Sum",
  "Topological Sort",
  "Graph Shortest Path",
  "Matrix Traversal",
  "Linked List Manipulation",
];

async function main() {
  for (const name of PATTERNS) {
    await prisma.pattern.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  const count = await prisma.pattern.count();
  console.log(`Seeded patterns. Total in DB: ${count}`);
}

main().finally(() => prisma.$disconnect());

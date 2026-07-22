"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { dayPlus, localDay, today } from "@/lib/dates";
import type { BookCategory, BookStatus } from "@/lib/types";

function revalidateAll() {
  for (const p of ["/", "/log", "/calendar", "/library", "/progress"]) {
    revalidatePath(p);
  }
}

export async function createBook(input: {
  title: string;
  author: string;
  category: BookCategory;
  totalPages?: number;
  status?: BookStatus;
}) {
  const status = input.status ?? "READING";
  const book = await prisma.book.create({
    data: {
      title: input.title.trim(),
      author: input.author.trim(),
      category: input.category,
      totalPages: input.totalPages ?? null,
      status,
      startedAt: status === "READING" ? today() : null,
    },
  });
  revalidateAll();
  return book;
}

/** Log a reading session: just the page reached. Pages read is derived. */
export async function logReadingSession(input: {
  bookId: string;
  endPage: number;
  minutes?: number;
  date?: string; // yyyy-MM-dd, defaults today
}) {
  const date = input.date
    ? localDay(new Date(`${input.date}T00:00:00`))
    : today();

  const book = await prisma.book.findUniqueOrThrow({
    where: { id: input.bookId },
    select: { totalPages: true, status: true, startedAt: true },
  });

  await prisma.$transaction([
    prisma.readingSession.create({
      data: {
        bookId: input.bookId,
        date,
        endPage: input.endPage,
        minutes: input.minutes ?? null,
      },
    }),
    prisma.book.update({
      where: { id: input.bookId },
      data: {
        // First session on a WANT_TO_READ book starts it.
        status: book.status === "WANT_TO_READ" ? "READING" : book.status,
        startedAt: book.startedAt ?? date,
      },
    }),
  ]);

  // Reaching the last page finishes the book automatically.
  const finished =
    book.totalPages !== null && input.endPage >= book.totalPages;
  if (finished) {
    await prisma.book.update({
      where: { id: input.bookId },
      data: { status: "FINISHED", finishedAt: date },
    });
  }

  revalidateAll();
  return { finished };
}

export async function updateBookStatus(
  id: string,
  status: BookStatus,
  rating?: number
) {
  await prisma.book.update({
    where: { id },
    data: {
      status,
      finishedAt: status === "FINISHED" ? today() : null,
      rating: status === "FINISHED" ? (rating ?? null) : null,
    },
  });
  revalidateAll();
}

export async function deleteBook(id: string) {
  await prisma.book.delete({ where: { id } });
  revalidateAll();
}

// ---------- Highlights ----------

export async function addHighlight(input: {
  bookId: string;
  text: string;
  page?: number;
  note?: string;
}) {
  await prisma.highlight.create({
    data: {
      bookId: input.bookId,
      text: input.text.trim(),
      page: input.page ?? null,
      note: input.note?.trim() || null,
    },
  });
  revalidateAll();
}

export async function deleteHighlight(id: string) {
  await prisma.highlight.delete({ where: { id } });
  revalidateAll();
}

/**
 * "Add to revision": promote a highlight into a real study Topic so the idea
 * enters the SM-2 queue. First review tomorrow, like any logged topic.
 */
export async function promoteHighlight(highlightId: string, subjectId?: string) {
  const highlight = await prisma.highlight.findUniqueOrThrow({
    where: { id: highlightId },
    include: { book: { select: { title: true } } },
  });
  if (highlight.topicId) return { alreadyPromoted: true };

  // DECISION: default subject is a find-or-create "Reading" subject (neutral
  // slate color) unless one is explicitly chosen.
  let sid = subjectId;
  if (!sid) {
    const reading = await prisma.subject.upsert({
      where: { name: "Reading" },
      create: { name: "Reading", color: "#8a93a6" },
      update: {},
    });
    sid = reading.id;
  }

  const now = today();
  const name =
    highlight.text.length > 80
      ? `${highlight.text.slice(0, 77)}…`
      : highlight.text;
  const notes = [
    highlight.text,
    highlight.note,
    `— ${highlight.book.title}${highlight.page ? `, p.${highlight.page}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const topic = await prisma.topic.create({
    data: {
      subjectId: sid,
      name,
      notes,
      source: "SELF",
      dateStudied: now,
      nextReview: dayPlus(now, 1),
    },
  });
  await prisma.highlight.update({
    where: { id: highlightId },
    data: { topicId: topic.id },
  });

  revalidateAll();
  return { alreadyPromoted: false };
}

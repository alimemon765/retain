import { prisma } from "@/lib/db";
import { getAllPatterns } from "@/lib/queries-dsa";
import { getReadingNudges } from "@/lib/queries-books";
import { LogTabs } from "@/components/log-tabs";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const [subjects, patterns, reading, wantToRead] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getAllPatterns(),
    getReadingNudges(),
    prisma.book.findMany({
      where: { status: "WANT_TO_READ" },
      select: { id: true, title: true, totalPages: true },
    }),
  ]);
  const readingBooks = [
    ...reading.map((r) => ({
      id: r.bookId,
      title: r.title,
      currentPage: r.currentPage,
      totalPages: r.totalPages,
    })),
    // Want-to-read books are loggable too — first session starts them.
    ...wantToRead.map((b) => ({
      id: b.id,
      title: b.title,
      currentPage: 0,
      totalPages: b.totalPages,
    })),
  ];
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Log</h1>
      <LogTabs subjects={subjects} patterns={patterns} readingBooks={readingBooks} />
    </div>
  );
}

import { prisma } from "@/lib/db";
import { getBooks } from "@/lib/queries-books";
import { BooksList } from "@/components/books-list";

export async function BooksTab() {
  const [books, subjects] = await Promise.all([
    getBooks(),
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return <BooksList books={books} subjects={subjects} />;
}

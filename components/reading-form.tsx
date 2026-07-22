"use client";

import { useState } from "react";
import { createBook, logReadingSession } from "@/app/book-actions";
import type { BookCategory } from "@/lib/types";

const CATEGORIES: BookCategory[] = ["TECHNICAL", "NONFICTION", "FICTION"];

export interface ReadingBookOption {
  id: string;
  title: string;
  currentPage: number;
  totalPages: number | null;
}

export function ReadingForm({ books }: { books: ReadingBookOption[] }) {
  const [bookList, setBookList] = useState(books);
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [creating, setCreating] = useState(books.length === 0);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newCategory, setNewCategory] = useState<BookCategory>("TECHNICAL");
  const [newTotalPages, setNewTotalPages] = useState("");

  const [endPage, setEndPage] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selected = bookList.find((b) => b.id === bookId);

  async function addBook() {
    if (!newTitle.trim() || !newAuthor.trim()) return;
    const b = await createBook({
      title: newTitle,
      author: newAuthor,
      category: newCategory,
      totalPages: newTotalPages ? Number(newTotalPages) : undefined,
    });
    setBookList((l) => [
      { id: b.id, title: b.title, currentPage: 0, totalPages: b.totalPages },
      ...l,
    ]);
    setBookId(b.id);
    setCreating(false);
    setNewTitle("");
    setNewAuthor("");
    setNewTotalPages("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookId || !endPage || saving) return;
    setSaving(true);
    try {
      const result = await logReadingSession({
        bookId,
        endPage: Number(endPage),
        minutes: minutes ? Number(minutes) : undefined,
      });
      const pagesRead = selected
        ? Math.max(Number(endPage) - selected.currentPage, 0)
        : 0;
      setBookList((l) =>
        l.map((b) =>
          b.id === bookId ? { ...b, currentPage: Number(endPage) } : b
        )
      );
      setEndPage("");
      setMinutes("");
      setToast(
        result.finished
          ? "Finished! 🎉"
          : pagesRead > 0
            ? `Logged — ${pagesRead} pages`
            : "Logged"
      );
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Book
        </label>
        <div className="flex flex-wrap gap-2">
          {bookList.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBookId(b.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                bookId === b.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-edge text-muted"
              }`}
            >
              {b.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-full border border-dashed border-edge px-3 py-1.5 text-sm text-muted"
          >
            + new book
          </button>
        </div>
        {creating && (
          <div className="flex flex-col gap-2 rounded-lg border border-edge bg-surface p-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
            />
            <input
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              placeholder="Author"
              className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted"
            />
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as BookCategory)}
                className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={newTotalPages}
                onChange={(e) => setNewTotalPages(e.target.value)}
                placeholder="Pages"
                className="w-24 rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted"
              />
            </div>
            <button
              type="button"
              onClick={addBook}
              className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
            >
              Add book
            </button>
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        <fieldset className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="end-page"
            className="text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            Page reached
          </label>
          <input
            id="end-page"
            type="number"
            min={selected ? selected.currentPage + 1 : 1}
            max={selected?.totalPages ?? undefined}
            inputMode="numeric"
            value={endPage}
            onChange={(e) => setEndPage(e.target.value)}
            placeholder={selected ? `now at ${selected.currentPage}` : "143"}
            required
            className="rounded-lg bg-surface px-3 py-3 outline-none placeholder:text-muted"
          />
        </fieldset>
        <fieldset className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="read-minutes"
            className="text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            Minutes <span className="normal-case">(optional)</span>
          </label>
          <input
            id="read-minutes"
            type="number"
            min="0"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="30"
            className="rounded-lg bg-surface px-3 py-3 outline-none placeholder:text-muted"
          />
        </fieldset>
      </div>

      {selected && selected.totalPages && (
        <p className="text-xs text-muted">
          {selected.title}: page {selected.currentPage} of {selected.totalPages}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !bookId || !endPage}
        className="rounded-xl bg-accent py-3.5 font-medium text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : "Log reading"}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-2 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </form>
  );
}

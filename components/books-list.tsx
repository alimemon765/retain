"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  addHighlight,
  deleteBook,
  deleteHighlight,
  promoteHighlight,
  updateBookStatus,
} from "@/app/book-actions";
import type { BookRow } from "@/lib/queries-books";
import type { BookStatus } from "@/lib/types";

const STATUS_LABEL: Record<BookStatus, string> = {
  WANT_TO_READ: "Want to read",
  READING: "Reading",
  FINISHED: "Finished",
  ABANDONED: "Abandoned",
};

const CATEGORY_COLORS: Record<string, string> = {
  TECHNICAL: "#5aa7d6",
  NONFICTION: "#6f9e6b",
  FICTION: "#c78fd6",
};

interface SubjectOption {
  id: string;
  name: string;
}

export function BooksList({
  books,
  subjects,
}: {
  books: BookRow[];
  subjects: SubjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);

  if (books.length === 0) {
    return (
      <p className="text-sm text-muted">
        No books yet — add one from Log → Reading.
      </p>
    );
  }

  const order: BookStatus[] = ["READING", "WANT_TO_READ", "FINISHED", "ABANDONED"];
  const grouped = order
    .map((status) => ({ status, list: books.filter((b) => b.status === status) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {grouped.map((g) => (
        <section key={g.status} className="flex flex-col gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {STATUS_LABEL[g.status]}
          </h2>
          {g.list.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              subjects={subjects}
              open={open === b.id}
              onToggle={() => setOpen((o) => (o === b.id ? null : b.id))}
              refresh={() => router.refresh()}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function BookCard({
  book,
  subjects,
  open,
  onToggle,
  refresh,
}: {
  book: BookRow;
  subjects: SubjectOption[];
  open: boolean;
  onToggle: () => void;
  refresh: () => void;
}) {
  const catColor = CATEGORY_COLORS[book.category] ?? "#8a93a6";
  const pct =
    book.totalPages && book.totalPages > 0
      ? Math.min(Math.round((book.currentPage / book.totalPages) * 100), 100)
      : null;

  return (
    <div
      className="rounded-xl border border-edge bg-surface"
      style={{ borderLeft: `3px solid ${catColor}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{book.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {book.author}
            {book.status === "READING" && book.totalPages
              ? ` · p.${book.currentPage}/${book.totalPages}`
              : ""}
            {book.status === "FINISHED" && book.rating
              ? ` · ${"★".repeat(book.rating)}`
              : ""}
          </p>
        </div>
        <span className="text-xs text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-edge p-3.5">
          {pct !== null && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: catColor }}
                />
              </div>
              <span className="text-xs text-muted">{pct}%</span>
            </div>
          )}
          <p className="text-xs text-muted">
            {book.sessionCount} sessions
            {book.recentRate !== null &&
              ` · ~${Math.round(book.recentRate)} pages/day`}
            {book.projectedFinish &&
              ` · projected finish ${format(new Date(book.projectedFinish), "d MMM")}`}
          </p>

          <StatusControls book={book} refresh={refresh} />
          <Highlights book={book} subjects={subjects} refresh={refresh} />
        </div>
      )}
    </div>
  );
}

function StatusControls({ book, refresh }: { book: BookRow; refresh: () => void }) {
  const [finishing, setFinishing] = useState(false);
  const [rating, setRating] = useState(0);

  async function setStatus(status: BookStatus, r?: number) {
    await updateBookStatus(book.id, status, r);
    setFinishing(false);
    refresh();
  }

  async function remove() {
    if (confirm(`Delete "${book.title}" and its history?`)) {
      await deleteBook(book.id);
      refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
      {book.status === "READING" && (
        <>
          {finishing ? (
            <span className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-base ${n <= rating ? "text-accent" : "text-muted"}`}
                >
                  ★
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStatus("FINISHED", rating || undefined)}
                className="ml-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-background"
              >
                Done
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setFinishing(true)} className="underline">
              mark finished
            </button>
          )}
          <button type="button" onClick={() => setStatus("ABANDONED")} className="underline">
            abandon
          </button>
        </>
      )}
      {book.status === "WANT_TO_READ" && (
        <button type="button" onClick={() => setStatus("READING")} className="underline">
          start reading
        </button>
      )}
      {(book.status === "FINISHED" || book.status === "ABANDONED") && (
        <button type="button" onClick={() => setStatus("READING")} className="underline">
          resume
        </button>
      )}
      <button type="button" onClick={remove} className="text-again underline">
        delete
      </button>
    </div>
  );
}

function Highlights({
  book,
  subjects,
  refresh,
}: {
  book: BookRow;
  subjects: SubjectOption[];
  refresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [note, setNote] = useState("");

  async function save() {
    if (!text.trim()) return;
    await addHighlight({
      bookId: book.id,
      text,
      page: page ? Number(page) : undefined,
      note: note || undefined,
    });
    setText("");
    setPage("");
    setNote("");
    setAdding(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Highlights ({book.highlights.length})
        </h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[11px] text-accent underline"
        >
          {adding ? "cancel" : "+ add"}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="The highlight…"
            className="rounded-lg bg-background px-3 py-2 text-sm outline-none placeholder:text-muted"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="Page"
              className="w-20 rounded-lg bg-background px-3 py-2 text-sm outline-none placeholder:text-muted"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="flex-1 rounded-lg bg-background px-3 py-2 text-sm outline-none placeholder:text-muted"
            />
          </div>
          <button
            type="button"
            onClick={save}
            className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
          >
            Save highlight
          </button>
        </div>
      )}

      {book.highlights.map((h) => (
        <HighlightRow
          key={h.id}
          highlight={h}
          isTechnical={book.category === "TECHNICAL"}
          subjects={subjects}
          refresh={refresh}
        />
      ))}
    </div>
  );
}

function HighlightRow({
  highlight,
  isTechnical,
  subjects,
  refresh,
}: {
  highlight: BookRow["highlights"][number];
  isTechnical: boolean;
  subjects: SubjectOption[];
  refresh: () => void;
}) {
  const [choosingSubject, setChoosingSubject] = useState(false);
  const [busy, setBusy] = useState(false);

  async function promote(subjectId?: string) {
    setBusy(true);
    try {
      await promoteHighlight(highlight.id, subjectId);
      setChoosingSubject(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await deleteHighlight(highlight.id);
    refresh();
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3">
      <p className="text-sm">{highlight.text}</p>
      {highlight.note && <p className="text-xs text-muted">{highlight.note}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>{highlight.page ? `p.${highlight.page}` : ""}</span>
        <span className="flex items-center gap-3">
          {highlight.topicId ? (
            <span className="text-good">in revision ✓</span>
          ) : isTechnical ? (
            choosingSubject ? (
              <span className="flex items-center gap-1.5">
                <select
                  disabled={busy}
                  onChange={(e) =>
                    promote(e.target.value === "__reading__" ? undefined : e.target.value)
                  }
                  defaultValue=""
                  className="rounded bg-background px-2 py-1 text-[11px] outline-none"
                >
                  <option value="" disabled>
                    subject…
                  </option>
                  <option value="__reading__">Reading (default)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setChoosingSubject(true)}
                className="text-accent underline"
              >
                add to revision
              </button>
            )
          ) : null}
          <button type="button" onClick={remove} className="text-again underline">
            delete
          </button>
        </span>
      </div>
    </div>
  );
}

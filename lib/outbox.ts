"use client";

import type { Rating } from "./types";

// IndexedDB outbox for review ratings made offline. Entries are flushed to
// /api/review when connectivity returns (see today-list.tsx).

const DB_NAME = "retain-outbox";
const STORE = "reviews";

export interface QueuedReview {
  id?: number;
  topicId: string;
  rating: Rating;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueReview(topicId: string, rating: Rating) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ topicId, rating, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function takeAll(): Promise<QueuedReview[]> {
  const db = await openDb();
  const items = await new Promise<QueuedReview[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedReview[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

async function remove(id: number) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Send queued reviews to the server. Returns how many were flushed. */
export async function flushOutbox(): Promise<number> {
  let flushed = 0;
  for (const item of await takeAll()) {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: item.topicId, rating: item.rating }),
    });
    // 404 = topic deleted meanwhile; drop the entry rather than retry forever.
    if (res.ok || res.status === 404) {
      if (item.id !== undefined) await remove(item.id);
      if (res.ok) flushed++;
    } else {
      break; // server error — keep the rest queued and retry later
    }
  }
  return flushed;
}

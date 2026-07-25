"use client";

import type { DsaOutcome, Rating } from "./types";

// IndexedDB outbox for actions made offline (topic reviews and DSA attempts).
// Entries flush to /api/review and /api/attempt when connectivity returns
// (see pwa-setup.tsx and the Today components).

const DB_NAME = "retain-outbox";
const STORE_REVIEWS = "reviews";
const STORE_ATTEMPTS = "attempts";
const STORE_BLOCKS = "blocks";
const DB_VERSION = 3;

export interface QueuedReview {
  id?: number;
  topicId: string;
  rating: Rating;
  queuedAt: number;
}

export interface QueuedBlockDone {
  id?: number;
  blockId: string;
  completed: boolean;
  queuedAt: number;
}

export interface QueuedAttempt {
  id?: number;
  problemId: string;
  outcome: DsaOutcome;
  minutesTaken?: number;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_REVIEWS)) {
        db.createObjectStore(STORE_REVIEWS, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        db.createObjectStore(STORE_ATTEMPTS, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_BLOCKS)) {
        db.createObjectStore(STORE_BLOCKS, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function add(store: string, value: object): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).add({ ...value, queuedAt: Date.now() });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

function getAll<T>(store: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => {
          db.close();
          resolve(req.result as T[]);
        };
        req.onerror = () => reject(req.error);
      })
  );
}

function remove(store: string, id: number): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function enqueueReview(topicId: string, rating: Rating) {
  return add(STORE_REVIEWS, { topicId, rating });
}

export function enqueueAttempt(
  problemId: string,
  outcome: DsaOutcome,
  minutesTaken?: number
) {
  return add(STORE_ATTEMPTS, { problemId, outcome, minutesTaken });
}

export function enqueueBlockCompletion(blockId: string, completed: boolean) {
  return add(STORE_BLOCKS, { blockId, completed });
}

/** Send all queued actions to the server. Returns how many were flushed. */
export async function flushOutbox(): Promise<number> {
  let flushed = 0;

  for (const item of await getAll<QueuedReview>(STORE_REVIEWS)) {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: item.topicId, rating: item.rating }),
    });
    // 404 = the row was deleted meanwhile; drop rather than retry forever.
    if (res.ok || res.status === 404) {
      if (item.id !== undefined) await remove(STORE_REVIEWS, item.id);
      if (res.ok) flushed++;
    } else {
      return flushed; // server error — keep the rest queued
    }
  }

  for (const item of await getAll<QueuedAttempt>(STORE_ATTEMPTS)) {
    const res = await fetch("/api/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemId: item.problemId,
        outcome: item.outcome,
        minutesTaken: item.minutesTaken,
      }),
    });
    if (res.ok || res.status === 404) {
      if (item.id !== undefined) await remove(STORE_ATTEMPTS, item.id);
      if (res.ok) flushed++;
    } else {
      return flushed;
    }
  }

  for (const item of await getAll<QueuedBlockDone>(STORE_BLOCKS)) {
    const res = await fetch("/api/block-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: item.blockId, completed: item.completed }),
    });
    if (res.ok || res.status === 404) {
      if (item.id !== undefined) await remove(STORE_BLOCKS, item.id);
      if (res.ok) flushed++;
    } else {
      return flushed;
    }
  }

  return flushed;
}

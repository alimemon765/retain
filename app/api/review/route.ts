import { NextResponse } from "next/server";
import { submitReview } from "@/app/actions";
import { RATINGS, type Rating } from "@/lib/types";
import { prisma } from "@/lib/db";

// Used by the offline outbox (lib/outbox.ts); the online path calls the
// submitReview server action directly.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    topicId?: string;
    rating?: string;
  } | null;

  if (!body?.topicId || !RATINGS.includes(body.rating as Rating)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const topic = await prisma.topic.findUnique({ where: { id: body.topicId } });
  if (!topic) {
    return NextResponse.json({ error: "topic not found" }, { status: 404 });
  }

  const result = await submitReview(body.topicId, body.rating as Rating);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { setBlockCompletion } from "@/lib/block-completion";

// Used by the offline outbox when a block is ticked off without a connection;
// the online path calls the setBlockCompleted server action directly.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    blockId?: string;
    completed?: boolean;
  } | null;

  if (typeof body?.blockId !== "string" || !body.blockId || typeof body.completed !== "boolean") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const found = await setBlockCompletion(body.blockId, body.completed);
  if (!found) {
    // Plan was regenerated while offline — drop the queued entry.
    return NextResponse.json({ error: "block not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Used by the offline outbox when a block is ticked off without a connection;
// the online path calls the setBlockCompleted server action directly.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    blockId?: string;
    completed?: boolean;
  } | null;

  if (!body?.blockId || typeof body.completed !== "boolean") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const block = await prisma.plannedBlock.findUnique({
    where: { id: body.blockId },
    select: { id: true },
  });
  if (!block) {
    // Plan was regenerated while offline — drop the queued entry.
    return NextResponse.json({ error: "block not found" }, { status: 404 });
  }

  await prisma.plannedBlock.update({
    where: { id: body.blockId },
    data: {
      completed: body.completed,
      completedAt: body.completed ? new Date() : null,
    },
  });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { submitAttempt } from "@/app/dsa-actions";
import { prisma } from "@/lib/db";
import { DSA_OUTCOMES, type DsaOutcome } from "@/lib/types";

// Used by the offline outbox (lib/outbox.ts); the online path calls the
// submitAttempt server action directly.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    problemId?: string;
    outcome?: string;
    minutesTaken?: number;
  } | null;

  if (!body?.problemId || !DSA_OUTCOMES.includes(body.outcome as DsaOutcome)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const problem = await prisma.problem.findUnique({
    where: { id: body.problemId },
  });
  if (!problem) {
    return NextResponse.json({ error: "problem not found" }, { status: 404 });
  }

  const result = await submitAttempt(
    body.problemId,
    body.outcome as DsaOutcome,
    typeof body.minutesTaken === "number" ? body.minutesTaken : undefined
  );
  return NextResponse.json(result);
}

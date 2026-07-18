import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";

// PIN-protected via proxy.ts like every other /api/push route.
export async function POST() {
  const result = await sendPushToAll({
    title: "Retain",
    body: "Test notification — push is working.",
  });
  if (result.sent === 0) {
    return NextResponse.json(
      { ...result, error: "no subscriptions received it" },
      { status: 500 }
    );
  }
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dayPlus, today } from "@/lib/dates";
import { sendPushToAll } from "@/lib/push";

// Hit daily by Vercel cron (see vercel.json) at 01:30 UTC = 07:00 IST.
// Vercel sends Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await prisma.topic.count({
    where: {
      status: { not: "SUSPENDED" },
      nextReview: { lt: dayPlus(today(), 1) },
    },
  });

  if (due === 0) return NextResponse.json({ due, sent: 0 });

  const result = await sendPushToAll({
    title: "Retain",
    body: `You have ${due} ${due === 1 ? "topic" : "topics"} to revise today.`,
  });
  return NextResponse.json({ due, ...result });
}

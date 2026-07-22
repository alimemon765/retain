import { getActiveTopics } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { dayKey, localDay } from "@/lib/dates";
import { CalendarView, type CalendarTopic } from "@/components/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [topics, subjects, problems] = await Promise.all([
    getActiveTopics(),
    prisma.subject.findMany({
      where: { examDate: { not: null } },
      select: { name: true, color: true, examDate: true },
    }),
    prisma.problem.findMany({
      where: { status: { not: "SUSPENDED" } },
      select: { id: true, title: true, nextReview: true },
    }),
  ]);

  const DSA_COLOR = "#d8b878"; // accent — DSA re-solves share one chip color
  const calendarTopics: CalendarTopic[] = [
    ...topics.map((t) => ({
      id: t.id,
      name: t.name,
      subjectName: t.subject.name,
      color: t.subject.color,
      day: dayKey(t.effectiveNextReview),
      pulledForward: t.pulledForward,
    })),
    ...problems.map((p) => ({
      id: `problem-${p.id}`,
      name: p.title,
      subjectName: "DSA",
      color: DSA_COLOR,
      day: dayKey(localDay(p.nextReview)),
      pulledForward: false,
    })),
  ];

  const exams = subjects.map((s) => ({
    name: s.name,
    color: s.color,
    day: dayKey(localDay(s.examDate!)),
  }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Calendar</h1>
      <CalendarView topics={calendarTopics} exams={exams} />
    </div>
  );
}

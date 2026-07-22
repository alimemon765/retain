import { prisma } from "./db";
import { today } from "./dates";
import { isQuarterlyReviewDue } from "./skills";
import type { EvidenceKind, SkillCategory } from "./types";

export interface SkillRow {
  id: string;
  name: string;
  category: SkillCategory;
  targetLevel: number;
  nextAction: string | null;
  archived: boolean;
  currentLevel: number | null;
  lastReviewedAt: Date | null;
  snapshots: { level: number; takenAt: Date; note: string | null }[];
  evidence: { id: string; kind: EvidenceKind; label: string; url: string | null }[];
}

export async function getSkills(includeArchived = false): Promise<SkillRow[]> {
  const skills = await prisma.skill.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { createdAt: "asc" },
    include: {
      snapshots: { orderBy: { takenAt: "asc" } },
      evidence: { orderBy: { addedAt: "desc" } },
    },
  });
  return skills.map((s) => {
    const latest = s.snapshots.at(-1);
    return {
      id: s.id,
      name: s.name,
      category: s.category as SkillCategory,
      targetLevel: s.targetLevel,
      nextAction: s.nextAction,
      archived: s.archived,
      currentLevel: latest?.level ?? null,
      lastReviewedAt: latest?.takenAt ?? null,
      snapshots: s.snapshots.map((sn) => ({
        level: sn.level,
        takenAt: sn.takenAt,
        note: sn.note,
      })),
      evidence: s.evidence.map((e) => ({
        id: e.id,
        kind: e.kind as EvidenceKind,
        label: e.label,
        url: e.url,
      })),
    };
  });
}

/** Whether the Today banner should prompt the quarterly skill review. */
export async function getSkillReviewDue(): Promise<boolean> {
  const [activeCount, newest] = await Promise.all([
    prisma.skill.count({ where: { archived: false } }),
    prisma.skillSnapshot.findFirst({
      where: { skill: { archived: false } },
      orderBy: { takenAt: "desc" },
      select: { takenAt: true },
    }),
  ]);
  return isQuarterlyReviewDue(newest?.takenAt ?? null, activeCount > 0, today());
}

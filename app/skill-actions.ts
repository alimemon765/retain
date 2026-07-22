"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { EvidenceKind, SkillCategory } from "@/lib/types";

function revalidateAll() {
  for (const p of ["/", "/log", "/library", "/progress", "/skills-review"]) {
    revalidatePath(p);
  }
}

/** Create a skill with its initial level snapshot. */
export async function createSkill(input: {
  name: string;
  category: SkillCategory;
  currentLevel: number;
  targetLevel: number;
  nextAction?: string;
}) {
  const skill = await prisma.skill.create({
    data: {
      name: input.name.trim(),
      category: input.category,
      targetLevel: input.targetLevel,
      nextAction: input.nextAction?.trim() || null,
      snapshots: { create: { level: input.currentLevel } },
    },
  });
  revalidateAll();
  return skill;
}

export async function updateSkill(
  id: string,
  data: { targetLevel?: number; nextAction?: string | null; archived?: boolean }
) {
  await prisma.skill.update({ where: { id }, data });
  revalidateAll();
}

export async function deleteSkill(id: string) {
  await prisma.skill.delete({ where: { id } });
  revalidateAll();
}

/**
 * Record a quarterly-review snapshot for one skill, optionally updating its
 * next action. This is the only place levels change outside creation.
 */
export async function submitSkillReview(input: {
  skillId: string;
  level: number;
  note?: string;
  nextAction?: string;
}) {
  await prisma.$transaction([
    prisma.skillSnapshot.create({
      data: {
        skillId: input.skillId,
        level: input.level,
        note: input.note?.trim() || null,
      },
    }),
    prisma.skill.update({
      where: { id: input.skillId },
      data: { nextAction: input.nextAction?.trim() || null },
    }),
  ]);
  revalidateAll();
}

export async function addEvidence(input: {
  skillId: string;
  kind: EvidenceKind;
  label: string;
  url?: string;
}) {
  await prisma.evidence.create({
    data: {
      skillId: input.skillId,
      kind: input.kind,
      label: input.label.trim(),
      url: input.url?.trim() || null,
    },
  });
  revalidateAll();
}

export async function deleteEvidence(id: string) {
  await prisma.evidence.delete({ where: { id } });
  revalidateAll();
}

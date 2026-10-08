import { prisma } from "./db";

/**
 * Tick a block on or off, and keep the tasks it carries in step: a task done
 * in the planner is done everywhere, so it is never planned a second time.
 * Shared by the server action and the offline outbox route.
 *
 * Returns false when the block no longer exists (e.g. the day was re-planned
 * while offline) so callers can drop the request rather than retry it.
 */
export async function setBlockCompletion(id: string, completed: boolean): Promise<boolean> {
  const block = await prisma.plannedBlock.findUnique({
    where: { id },
    select: { taskIds: true },
  });
  if (!block) return false;

  await prisma.$transaction([
    prisma.plannedBlock.update({
      where: { id },
      data: { completed, completedAt: completed ? new Date() : null },
    }),
    prisma.manualTask.updateMany({
      where: { id: { in: block.taskIds } },
      data: { done: completed },
    }),
  ]);
  return true;
}

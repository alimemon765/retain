import { fixedBlock } from "./blocks";
import type { Assignment } from "./distribute";

// A later assistant run can replace an earlier one only if the earlier run's
// work is marked. Pure: decides which freshly planned blocks are the assistant's.

interface MarkableBlock {
  startTime: string;
  title: string;
  taskIds: readonly string[];
  existingId?: string;
}

const signature = (b: { startTime: string; title: string }) => `${b.startTime} ${b.title}`;

/** True for new blocks that hold a task this run saved, or a fixed-time item it placed. */
export function assistantBlockMarker(
  dayAssignments: readonly Assignment[],
  savedTaskIds: ReadonlySet<string>
): (b: MarkableBlock) => boolean {
  const fixed = new Set(
    dayAssignments.filter((a) => a.task.fixedStart !== null).map((a) => signature(fixedBlock(a)))
  );
  return (b) =>
    !b.existingId && (b.taskIds.some((id) => savedTaskIds.has(id)) || fixed.has(signature(b)));
}

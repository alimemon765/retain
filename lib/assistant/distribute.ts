import type { AssistantTask } from "./schema";

// Decides which day each task goes on; the existing single-day scheduler then
// decides the time. Pure: inputs are never mutated, state is rebuilt per step.
//
// Order of placement, most constrained first:
//   1. fixed-time and pinned-day items (the student named the day)
//   2. deadline items, earliest deadline first, on the earliest day that fits
//   3. everything else by priority, biggest first, on the least loaded day

export interface DayCapacity {
  iso: string; // yyyy-MM-dd
  /** Minutes of work the day's scheduler can actually place. */
  capacityMins: number;
}

export interface Assignment {
  instanceId: string;
  taskId: string;
  iso: string;
  task: AssistantTask;
}

export interface OverflowItem {
  taskId: string;
  title: string;
  reason: string;
}

interface Instance {
  instanceId: string;
  task: AssistantTask;
  order: number;
}

type Remaining = Readonly<Record<string, number>>;

/** "Every evening" becomes one pinned instance per day in the window. */
function expand(tasks: readonly AssistantTask[], days: readonly DayCapacity[]): Instance[] {
  return tasks.flatMap((task, order) =>
    task.repeatDaily
      ? days.map((d) => ({
          instanceId: `${task.id}@${d.iso}`,
          task: { ...task, onDate: d.iso },
          order,
        }))
      : [{ instanceId: task.id, task, order }]
  );
}

function rank(i: Instance): number {
  if (i.task.fixedStart !== null || i.task.onDate !== null) return 0;
  return i.task.deadline !== null ? 1 : 2;
}

function compare(a: Instance, b: Instance): number {
  return (
    rank(a) - rank(b) ||
    (a.task.deadline ?? "").localeCompare(b.task.deadline ?? "") ||
    a.task.priority - b.task.priority ||
    b.task.estimateMins - a.task.estimateMins ||
    a.order - b.order
  );
}

/** Earliest eligible day with room — the do-it-early bias for deadlines. */
function earliestFit(days: readonly DayCapacity[], left: Remaining, mins: number, deadline: string) {
  return days.find((d) => d.iso <= deadline && left[d.iso] >= mins)?.iso ?? null;
}

/** Day with the most room left; ties go to the earlier day. */
function leastLoaded(days: readonly DayCapacity[], left: Remaining, mins: number) {
  const fits = days.filter((d) => left[d.iso] >= mins);
  if (fits.length === 0) return null;
  return fits.reduce((best, d) => (left[d.iso] > left[best.iso] ? d : best)).iso;
}

function chooseDay(
  i: Instance,
  days: readonly DayCapacity[],
  left: Remaining
): { iso: string } | { reason: string } {
  const { task } = i;
  if (task.onDate !== null) return { iso: task.onDate };
  // A time with no day means the student meant the first day in view.
  if (task.fixedStart !== null) return { iso: days[0].iso };

  if (task.deadline !== null) {
    const iso = earliestFit(days, left, task.estimateMins, task.deadline);
    return iso ? { iso } : { reason: `No room before its deadline (${task.deadline}).` };
  }
  const iso = leastLoaded(days, left, task.estimateMins);
  return iso ? { iso } : { reason: `No room in the next ${days.length} days.` };
}

export interface TimeBudget {
  /** Minutes of work asked for, counting a daily item once per day. */
  requestedMins: number;
  /** Minutes the window's days can take after their own due work. */
  freeMins: number;
}

/** Asked-for work against free time, so the student can see at once whether it fits. */
export function timeBudget(tasks: readonly AssistantTask[], days: readonly DayCapacity[]): TimeBudget {
  return {
    requestedMins: expand(tasks, days).reduce((n, i) => n + i.task.estimateMins, 0),
    freeMins: days.reduce((n, d) => n + Math.max(d.capacityMins, 0), 0),
  };
}

export function distributeTasks(
  tasks: readonly AssistantTask[],
  days: readonly DayCapacity[]
): { assignments: Assignment[]; overflow: OverflowItem[] } {
  if (days.length === 0) {
    return {
      assignments: [],
      overflow: tasks.map((t) => ({ taskId: t.id, title: t.title, reason: "No days to plan." })),
    };
  }

  const initial: Remaining = Object.fromEntries(days.map((d) => [d.iso, d.capacityMins]));
  const ordered = [...expand(tasks, days)].sort(compare);

  const result = ordered.reduce(
    (acc, i) => {
      const choice = chooseDay(i, days, acc.left);
      if ("reason" in choice) {
        const miss = { taskId: i.task.id, title: i.task.title, reason: choice.reason };
        return { ...acc, overflow: [...acc.overflow, miss] };
      }
      const assignment = { instanceId: i.instanceId, taskId: i.task.id, iso: choice.iso, task: i.task };
      return {
        left: { ...acc.left, [choice.iso]: acc.left[choice.iso] - i.task.estimateMins },
        assignments: [...acc.assignments, assignment],
        overflow: acc.overflow,
      };
    },
    { left: initial, assignments: [] as Assignment[], overflow: [] as OverflowItem[] }
  );

  return { assignments: result.assignments, overflow: result.overflow };
}

import { z } from "zod";
import type { ManualTaskKind } from "../types";

// The contract between Claude and the planner. Kept deliberately flat and free
// of numeric/length constraints: structured outputs enforce the shape, and
// normalize.ts enforces the ranges (so a bad value is clamped, not rejected).

export const ASSISTANT_KINDS = [
  "STUDY",
  "DSA",
  "READING",
  "SKILL",
  "ADMIN",
] as const satisfies readonly ManualTaskKind[];

export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

export const RawAssistantTaskSchema = z.object({
  title: z.string().describe("Short, specific, in the student's own words."),
  kind: z.enum(ASSISTANT_KINDS),
  estimateMins: z.number().describe("Minutes of focused work."),
  priority: z.number().describe("1 = most important … 5 = least."),
  deadline: z
    .string()
    .nullable()
    .describe("yyyy-MM-dd it must be done by, or null."),
  onDate: z
    .string()
    .nullable()
    .describe("yyyy-MM-dd of the specific day named, or null."),
  fixedStart: z
    .string()
    .nullable()
    .describe("HH:mm 24-hour, only when an exact time is given, else null."),
  repeatDaily: z
    .boolean()
    .describe("True for things wanted every day in the window."),
});

export const AssistantReplySchema = z.object({
  tasks: z.array(RawAssistantTaskSchema),
  notes: z
    .array(z.string())
    .describe("Assumptions or things that could not be interpreted."),
});

export type RawAssistantTask = z.infer<typeof RawAssistantTaskSchema>;
export type AssistantReply = z.infer<typeof AssistantReplySchema>;

/** A task after normalization: validated, clamped, and given a stable id. */
export interface AssistantTask extends RawAssistantTask {
  id: string;
}

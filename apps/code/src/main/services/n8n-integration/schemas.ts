import { z } from "zod";

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
});

export const executionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  status: z.enum(["success", "error", "running", "waiting", "canceled"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  mode: z.string(),
});

export const getWorkflowsOutput = z.object({
  workflows: z.array(workflowSchema),
  total: z.number(),
});

export const getRecentExecutionsInput = z.object({
  limit: z.number().min(1).max(100).default(20),
});

export const getRecentExecutionsOutput = z.object({
  executions: z.array(executionSchema),
  total: z.number(),
});

export type Workflow = z.infer<typeof workflowSchema>;
export type Execution = z.infer<typeof executionSchema>;
export type GetWorkflowsOutput = z.infer<typeof getWorkflowsOutput>;
export type GetRecentExecutionsOutput = z.infer<typeof getRecentExecutionsOutput>;

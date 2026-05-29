import { z } from "zod";

export const n8nWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  updatedAt: z.string().nullable(),
});

export const n8nExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string().nullable(),
  status: z.string(),
  mode: z.string().nullable(),
  startedAt: z.string().nullable(),
  stoppedAt: z.string().nullable(),
});

export const n8nWorkflowsOutput = z.array(n8nWorkflowSchema);
export const n8nRecentExecutionsOutput = z.array(n8nExecutionSchema);
export const n8nErrorCountOutput = z.object({
  count: z.number(),
});

export type N8nWorkflow = z.infer<typeof n8nWorkflowSchema>;
export type N8nExecution = z.infer<typeof n8nExecutionSchema>;
export type N8nErrorCount = z.infer<typeof n8nErrorCountOutput>;
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

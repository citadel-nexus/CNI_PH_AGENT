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

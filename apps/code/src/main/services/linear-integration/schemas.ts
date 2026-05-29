import { z } from "zod";

export {
  type CloudRegion,
  cloudRegion,
  type StartIntegrationFlowInput as StartLinearFlowInput,
  type StartIntegrationFlowOutput as StartLinearFlowOutput,
  startIntegrationFlowInput as startLinearFlowInput,
  startIntegrationFlowOutput as startLinearFlowOutput,
} from "../integration-flow-schemas";

export const linearIssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  priority: z.number().nullable(),
  state: z.string().nullable(),
  assignee: z.string().nullable(),
  updatedAt: z.string().nullable(),
  url: z.string().nullable(),
});

export const linearProjectStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string().nullable(),
  progress: z.number().nullable(),
  updatedAt: z.string().nullable(),
  lead: z.string().nullable(),
  url: z.string().nullable(),
});

export const linearRecentUpdateSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  state: z.string().nullable(),
  updatedAt: z.string().nullable(),
  url: z.string().nullable(),
});

export const linearActiveIssuesOutput = z.array(linearIssueSchema);
export const linearProjectStatusOutput = z.array(linearProjectStatusSchema);
export const linearRecentUpdatesOutput = z.array(linearRecentUpdateSchema);

export type LinearIssue = z.infer<typeof linearIssueSchema>;
export type LinearProjectStatus = z.infer<typeof linearProjectStatusSchema>;
export type LinearRecentUpdate = z.infer<typeof linearRecentUpdateSchema>;

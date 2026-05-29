import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  n8nErrorCountOutput,
  n8nRecentExecutionsOutput,
  n8nWorkflowsOutput,
} from "../../services/n8n-integration/schemas";
import type { N8nIntegrationService } from "../../services/n8n-integration/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<N8nIntegrationService>(MAIN_TOKENS.N8nIntegrationService);

export const n8nIntegrationRouter = router({
  getWorkflows: publicProcedure
    .output(n8nWorkflowsOutput)
    .query(() => getService().getWorkflows()),

  getRecentExecutions: publicProcedure
    .output(n8nRecentExecutionsOutput)
    .query(() => getService().getRecentExecutions()),

  getErrorCount: publicProcedure.output(n8nErrorCountOutput).query(async () => {
    const count = await getService().getErrorCount();
    return { count };
  }),
});
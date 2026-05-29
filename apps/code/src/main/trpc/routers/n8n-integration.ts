import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  getRecentExecutionsInput,
  getRecentExecutionsOutput,
  getWorkflowsOutput,
} from "../../services/n8n-integration/schemas";
import type { N8nIntegrationService } from "../../services/n8n-integration/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<N8nIntegrationService>(MAIN_TOKENS.N8nIntegrationService);

export const n8nIntegrationRouter = router({
  getWorkflows: publicProcedure
    .output(getWorkflowsOutput)
    .query(() => getService().getWorkflows()),
  getRecentExecutions: publicProcedure
    .input(getRecentExecutionsInput)
    .output(getRecentExecutionsOutput)
    .query(({ input }) => getService().getRecentExecutions(input.limit)),
});

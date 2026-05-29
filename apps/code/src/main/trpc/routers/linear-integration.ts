import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  linearActiveIssuesOutput,
  linearProjectStatusOutput,
  linearRecentUpdatesOutput,
  startLinearFlowInput,
  startLinearFlowOutput,
} from "../../services/linear-integration/schemas";
import type { LinearIntegrationService } from "../../services/linear-integration/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<LinearIntegrationService>(MAIN_TOKENS.LinearIntegrationService);

export const linearIntegrationRouter = router({
  startFlow: publicProcedure
    .input(startLinearFlowInput)
    .output(startLinearFlowOutput)
    .mutation(({ input }) =>
      getService().startFlow(input.region, input.projectId),
    ),

  getActiveIssues: publicProcedure
    .output(linearActiveIssuesOutput)
    .query(() => getService().getActiveIssues()),

  getProjectStatus: publicProcedure
    .output(linearProjectStatusOutput)
    .query(() => getService().getProjectStatus()),

  getRecentUpdates: publicProcedure
    .output(linearRecentUpdatesOutput)
    .query(() => getService().getRecentUpdates()),
});
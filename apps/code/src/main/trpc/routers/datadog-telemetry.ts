import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import { telemetryStatsOutput } from "../../services/datadog-telemetry/schemas";
import type { DatadogTelemetryService } from "../../services/datadog-telemetry/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<DatadogTelemetryService>(MAIN_TOKENS.DatadogTelemetryService);

export const datadogTelemetryRouter = router({
  getStats: publicProcedure
    .output(telemetryStatsOutput)
    .query(() => getService().getStats()),
});

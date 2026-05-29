import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  datadogDashboardStatusOutput,
  endSpanInput,
  gaugeInput,
  histogramInput,
  incrementMetricInput,
  startSpanInput,
  startSpanOutput,
  telemetryOperationOutput,
  telemetryStatsOutput,
  trackEventInput,
} from "../../services/datadog-telemetry/schemas";
import type { DatadogTelemetryService } from "../../services/datadog-telemetry/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<DatadogTelemetryService>(MAIN_TOKENS.DatadogTelemetryService);

export const datadogTelemetryRouter = router({
  startSpan: publicProcedure
    .input(startSpanInput)
    .output(startSpanOutput)
    .mutation(({ input }) => getService().startSpan(input.name, input.tags)),

  endSpan: publicProcedure
    .input(endSpanInput)
    .output(telemetryOperationOutput)
    .mutation(({ input }) => {
      getService().endSpan(input.spanId);
      return { success: true };
    }),

  incrementMetric: publicProcedure
    .input(incrementMetricInput)
    .output(telemetryOperationOutput)
    .mutation(({ input }) => {
      getService().incrementMetric(input.name, input.tags);
      return { success: true };
    }),

  gauge: publicProcedure
    .input(gaugeInput)
    .output(telemetryOperationOutput)
    .mutation(({ input }) => {
      getService().gauge(input.name, input.value, input.tags);
      return { success: true };
    }),

  histogram: publicProcedure
    .input(histogramInput)
    .output(telemetryOperationOutput)
    .mutation(({ input }) => {
      getService().histogram(input.name, input.value, input.tags);
      return { success: true };
    }),

  trackEvent: publicProcedure
    .input(trackEventInput)
    .output(telemetryOperationOutput)
    .mutation(async ({ input }) => {
      await getService().trackEvent(input.title, input.text, input.tags);
      return { success: true };
    }),

  getDashboardStatus: publicProcedure
    .output(datadogDashboardStatusOutput)
    .query(() => getService().getDashboardStatus()),

  getStats: publicProcedure
    .output(telemetryStatsOutput)
    .query(() => getService().getStats()),
});
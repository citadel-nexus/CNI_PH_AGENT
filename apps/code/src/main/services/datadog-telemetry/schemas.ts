import { z } from "zod";

export const telemetryTagValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
]);

export const telemetryTagsSchema = z
  .record(z.string(), telemetryTagValueSchema)
  .optional();

export const startSpanInput = z.object({
  name: z.string().min(1),
  tags: telemetryTagsSchema,
});

export const startSpanOutput = z.object({
  spanId: z.string(),
});

export const endSpanInput = z.object({
  spanId: z.string(),
});

export const metricInput = z.object({
  name: z.string().min(1),
  tags: telemetryTagsSchema,
});

export const incrementMetricInput = metricInput;

export const gaugeInput = metricInput.extend({
  value: z.number(),
});

export const histogramInput = metricInput.extend({
  value: z.number(),
});

export const trackEventInput = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  tags: telemetryTagsSchema,
});

export const telemetryOperationOutput = z.object({
  success: z.boolean(),
});

export const datadogDashboardStatusOutput = z.object({
  activeAlerts: z.number(),
  errorRate: z.number(),
  apmHealthy: z.boolean(),
  recentEventCount: z.number(),
  lastEventAt: z.string().nullable(),
});

export type TelemetryTags = z.infer<typeof telemetryTagsSchema>;
export type StartSpanInput = z.infer<typeof startSpanInput>;
export type StartSpanOutput = z.infer<typeof startSpanOutput>;
export type EndSpanInput = z.infer<typeof endSpanInput>;
export type IncrementMetricInput = z.infer<typeof incrementMetricInput>;
export type GaugeInput = z.infer<typeof gaugeInput>;
export type HistogramInput = z.infer<typeof histogramInput>;
export type TrackEventInput = z.infer<typeof trackEventInput>;
export type DatadogDashboardStatusOutput = z.infer<
  typeof datadogDashboardStatusOutput
>;
export const metricTagsSchema = z.record(z.string(), z.string()).optional();

export const incrementMetricInput = z.object({
  name: z.string(),
  tags: metricTagsSchema,
});

export const gaugeMetricInput = z.object({
  name: z.string(),
  value: z.number(),
  tags: metricTagsSchema,
});

export const histogramMetricInput = z.object({
  name: z.string(),
  value: z.number(),
  tags: metricTagsSchema,
});

export const trackEventInput = z.object({
  title: z.string(),
  text: z.string(),
  tags: z.array(z.string()).optional(),
});

export const agentMetricSchema = z.object({
  sessionsStarted: z.number(),
  sessionsEnded: z.number(),
  sessionErrors: z.number(),
  toolCallsTotal: z.number(),
  llmActivityCount: z.number(),
  lastSessionDurationMs: z.number().nullable(),
});

export const updateMetricSchema = z.object({
  checksInitiated: z.number(),
  downloadsStarted: z.number(),
  installsInitiated: z.number(),
});

export const telemetryStatsOutput = z.object({
  agent: agentMetricSchema,
  updates: updateMetricSchema,
  eventsEmitted: z.number(),
  statsdEnabled: z.boolean(),
});

export type TelemetryStatsOutput = z.infer<typeof telemetryStatsOutput>;

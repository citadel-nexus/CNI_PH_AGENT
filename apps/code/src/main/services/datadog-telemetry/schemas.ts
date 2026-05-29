import { z } from "zod";

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
export type IncrementMetricInput = z.infer<typeof incrementMetricInput>;
export type GaugeMetricInput = z.infer<typeof gaugeMetricInput>;
export type HistogramMetricInput = z.infer<typeof histogramMetricInput>;
export type TrackEventInput = z.infer<typeof trackEventInput>;

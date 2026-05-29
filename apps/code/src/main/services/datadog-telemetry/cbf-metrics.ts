import { getDatadogTelemetry, trackInDatadog } from "./service";

type MetricTagValue = string | number | boolean | undefined;
type MetricTags = Record<string, MetricTagValue>;

export type CbfRunStatus = "success" | "failure";

export interface CbfMetricContext {
  dispatchId?: string;
  blueprintId?: string;
  tags?: MetricTags;
}

function withContext(
  context?: CbfMetricContext,
  tags: MetricTags = {},
): Record<string, string | number | boolean> {
  const merged: MetricTags = {
    ...(context?.dispatchId ? { dispatch_id: context.dispatchId } : {}),
    ...(context?.blueprintId ? { blueprint_id: context.blueprintId } : {}),
    ...(context?.tags ?? {}),
    ...tags,
  };

  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean>;
}

function incrementMetric(
  name: string,
  tags: Record<string, string | number | boolean>,
): void {
  const telemetry = getDatadogTelemetry();
  if (telemetry) {
    telemetry.increment(name, tags);
    return;
  }
  trackInDatadog(name, tags);
}

function gaugeMetric(
  name: string,
  value: number,
  tags: Record<string, string | number | boolean>,
): void {
  const telemetry = getDatadogTelemetry();
  if (telemetry) {
    telemetry.gauge(name, value, tags);
    return;
  }
  trackInDatadog(name, { ...tags, value });
}

function histogramMetric(
  name: string,
  value: number,
  tags: Record<string, string | number | boolean>,
): void {
  const telemetry = getDatadogTelemetry();
  if (telemetry) {
    telemetry.histogram(name, value, tags);
    return;
  }
  trackInDatadog(name, { ...tags, value });
}

export function recordCbfBlueprintRefresh(context?: CbfMetricContext): void {
  incrementMetric("cbf.pull.blueprint_refresh", withContext(context));
}

export function recordCbfBlueprintSelect(context?: CbfMetricContext): void {
  incrementMetric("cbf.pull.blueprint_select", withContext(context));
}

export function recordCbfFleetGrowthCycle(context?: CbfMetricContext): void {
  incrementMetric("cbf.fleet.growth_cycle", withContext(context));
}

export function recordCbfFleetDomainCoverage(
  score: number,
  context?: CbfMetricContext,
): void {
  gaugeMetric("cbf.fleet.domain_coverage", score, withContext(context));
}

export function recordCbfBuildStarted(context?: CbfMetricContext): void {
  incrementMetric("cbf.build.started", withContext(context));
}

export function recordCbfBuildCompleted(
  status: CbfRunStatus,
  context?: CbfMetricContext,
): void {
  incrementMetric("cbf.build.completed", withContext(context, { status }));
}

export function recordCbfBuildIterate(context?: CbfMetricContext): void {
  incrementMetric("cbf.build.iterate", withContext(context));
}

export function recordCbfBuildDurationMs(
  durationMs: number,
  context?: CbfMetricContext,
): void {
  histogramMetric("cbf.build.duration_ms", durationMs, withContext(context));
}

export function recordCbfSessionStarted(context?: CbfMetricContext): void {
  incrementMetric("cbf.session.started", withContext(context));
}

export function recordCbfSessionEnded(
  status: CbfRunStatus,
  context?: CbfMetricContext,
): void {
  incrementMetric("cbf.session.ended", withContext(context, { status }));
}

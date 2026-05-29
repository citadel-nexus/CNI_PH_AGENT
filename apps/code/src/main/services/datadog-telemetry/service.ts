import { randomUUID } from "node:crypto";
import tracer from "dd-trace";
import StatsD from "hot-shots";
import { injectable, preDestroy } from "inversify";
import { logger } from "../../utils/logger";
import type { TelemetryTags } from "./schemas";

const log = logger.scope("datadog-telemetry-service");

const EVENT_SOURCE = "posthog-code";
const DEFAULT_SITE = "us5.datadoghq.com";
const DEFAULT_ENV = "prod";
const DEFAULT_SERVICE = "citadel-posthog-code";

type DatadogSpan = ReturnType<typeof tracer.startSpan>;
interface TrackedDatadogEvent {
  title: string;
  timestamp: number;
}

export interface DatadogSpanHandle {
  spanId: string;
}

@injectable()
export class DatadogTelemetryService {
  private static tracerReady = false;
  private readonly site = process.env.DD_SITE || DEFAULT_SITE;
  private readonly env = process.env.DD_ENV || DEFAULT_ENV;
  private readonly service = process.env.DD_SERVICE || DEFAULT_SERVICE;
  private readonly apiKey = process.env.DD_API_KEY;
  private readonly spans = new Map<string, DatadogSpan>();
  private readonly recentEvents: TrackedDatadogEvent[] = [];
  private readonly statsd: StatsD;
  private metricCalls = 0;
  private errorMetricCalls = 0;

  constructor() {
    if (!DatadogTelemetryService.tracerReady) {
      tracer.init({
        env: this.env,
        service: this.service,
        logInjection: true,
      });
      DatadogTelemetryService.tracerReady = true;
    }

    this.statsd = new StatsD({
      host: process.env.DD_AGENT_HOST ?? "127.0.0.1",
      port: Number(process.env.DD_DOGSTATSD_PORT ?? 8125),
      globalTags: {
        env: this.env,
        service: this.service,
      },
      telegraf: false,
      errorHandler: (error) => {
        log.debug("DogStatsD metric send failed", {
          error: error.message,
        });
      },
    });
  }

  public startSpan(name: string, tags?: TelemetryTags): DatadogSpanHandle {
    const spanId = randomUUID();
    const span = tracer.startSpan(name, {
      tags: this.normalizeTags(tags),
    });
    this.spans.set(spanId, span);
    return { spanId };
  }

  public endSpan(span: DatadogSpanHandle | string): void {
    const spanId = typeof span === "string" ? span : span.spanId;
    const activeSpan = this.spans.get(spanId);
    if (!activeSpan) {
      return;
    }

    activeSpan.finish();
    this.spans.delete(spanId);
  }

  public incrementMetric(name: string, tags?: TelemetryTags): void {
    this.recordMetric(name, tags);
    this.statsd.increment(name, 1, undefined, this.toTagList(tags));
  }

  public gauge(name: string, value: number, tags?: TelemetryTags): void {
    this.recordMetric(name, tags);
    this.statsd.gauge(name, value, undefined, this.toTagList(tags));
  }

  public histogram(name: string, value: number, tags?: TelemetryTags): void {
    this.recordMetric(name, tags);
    this.statsd.histogram(name, value, undefined, this.toTagList(tags));
  }

  public async trackEvent(
    title: string,
    text: string,
    tags?: TelemetryTags,
  ): Promise<void> {
    this.recordEvent(title);

    if (!this.apiKey) {
      return;
    }

    const endpoint = `https://api.${this.site}/api/v1/events`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": this.apiKey,
        },
        body: JSON.stringify({
          title,
          text,
          alert_type: "info",
          source_type_name: EVENT_SOURCE,
          tags: this.toTagList(tags),
        }),
      });

      if (!response.ok) {
        log.warn("Failed to send Datadog event", {
          status: response.status,
          statusText: response.statusText,
          title,
        });
      }
    } catch (error) {
      log.warn("Datadog event request failed", {
        error: error instanceof Error ? error.message : String(error),
        title,
      });
    }
  }

  public getDashboardStatus(): {
    activeAlerts: number;
    errorRate: number;
    apmHealthy: boolean;
    recentEventCount: number;
    lastEventAt: string | null;
  } {
    const now = Date.now();
    const lookbackWindowMs = 15 * 60 * 1000;
    const activeAlerts = this.recentEvents.filter(
      (event) =>
        now - event.timestamp <= lookbackWindowMs &&
        /(error|failed|alert)/i.test(event.title),
    ).length;

    const errorRate =
      this.metricCalls === 0
        ? 0
        : (this.errorMetricCalls / this.metricCalls) * 100;
    const lastEvent = this.recentEvents[this.recentEvents.length - 1];

    return {
      activeAlerts,
      errorRate: Number(errorRate.toFixed(2)),
      apmHealthy: activeAlerts === 0,
      recentEventCount: this.recentEvents.length,
      lastEventAt: lastEvent
        ? new Date(lastEvent.timestamp).toISOString()
        : null,
    };
  }

  private toTagList(tags?: TelemetryTags): string[] {
    if (!tags) {
      return [`env:${this.env}`, `service:${this.service}`];
    }

    const normalized = this.normalizeTags(tags);
    return Object.entries(normalized).map(([key, value]) => `${key}:${value}`);
  }

  private normalizeTags(tags?: TelemetryTags): Record<string, string> {
    return {
      env: this.env,
      service: this.service,
      ...(tags
        ? Object.fromEntries(
            Object.entries(tags).map(([key, value]) => [key, String(value)]),
          )
        : {}),
    };
  }

  private recordMetric(name: string, tags?: TelemetryTags): void {
    this.metricCalls += 1;
    const normalized = this.normalizeTags(tags);
    if (
      name.includes("error") ||
      normalized.status === "failed" ||
      normalized.status === "error"
    ) {
      this.errorMetricCalls += 1;
    }
  }

  private recordEvent(title: string): void {
    this.recentEvents.push({
      title,
      timestamp: Date.now(),
    });
    if (this.recentEvents.length > 200) {
      this.recentEvents.splice(0, this.recentEvents.length - 200);
    }
  }

  @preDestroy()
  public shutdown(): void {
    for (const spanId of this.spans.keys()) {
      this.endSpan(spanId);
    }
    this.statsd.close();
  }
}

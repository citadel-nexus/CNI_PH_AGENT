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
import * as dgram from "node:dgram";
import { inject, injectable, postConstruct, preDestroy } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { AgentServiceEvent } from "../agent/schemas";
import type { AgentService } from "../agent/service";
import type { UpdatesService } from "../updates/service";
import { UpdatesEvent } from "../updates/schemas";
import type { TelemetryStatsOutput } from "./schemas";

const log = logger.scope("datadog-telemetry");

const STATSD_HOST = "localhost";
const STATSD_PORT = 8125;
const MAX_BUFFER_SIZE = 1400;

let _instance: DatadogTelemetryService | null = null;

export function getDatadogTelemetry(): DatadogTelemetryService | null {
  return _instance;
}

export function trackInDatadog(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  _instance?.increment(`app.event.${eventName}`, tagsFromProperties(properties));
}

function tagsFromProperties(
  props?: Record<string, string | number | boolean>,
): Record<string, string> | undefined {
  if (!props) return undefined;
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    tags[k] = String(v);
  }
  return tags;
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
  private socket: dgram.Socket | null = null;
  private enabled = false;
  private env: string;
  private serviceTag: string;

  private agentStats = {
    sessionsStarted: 0,
    sessionsEnded: 0,
    sessionErrors: 0,
    toolCallsTotal: 0,
    llmActivityCount: 0,
    lastSessionDurationMs: null as number | null,
  };

  private updateStats = {
    checksInitiated: 0,
    downloadsStarted: 0,
    installsInitiated: 0,
  };

  private eventsEmitted = 0;

  private readonly onLlmActivity = (): void => {
    this.agentStats.llmActivityCount++;
    this.increment("agent.llm.activity");
  };

  private readonly onSessionsIdle = (): void => {
    this.increment("agent.sessions.idle");
  };

  private readonly onSessionEvent = (payload: {
    taskRunId: string;
    payload: unknown;
  }): void => {
    const msg = payload.payload as { type?: string };
    if (msg?.type === "session_started") {
      this.agentStats.sessionsStarted++;
      this.increment("agent.sessions.started");
    } else if (
      msg?.type === "session_ended" ||
      msg?.type === "session_stopped"
    ) {
      this.agentStats.sessionsEnded++;
      this.increment("agent.sessions.ended");
    }
  };

  private readonly onUpdatesStatus = (payload: {
    checking: boolean;
    downloading?: boolean;
    updateReady?: boolean;
  }): void => {
    if (payload.checking && !payload.downloading) {
      this.updateStats.checksInitiated++;
      this.increment("updates.check.started");
    }
    if (payload.downloading) {
      this.increment("updates.downloading");
    }
    if (payload.updateReady) {
      this.updateStats.downloadsStarted++;
      this.increment("updates.ready");
    }
  };

  private readonly onUpdateReady = (payload: {
    version: string | null;
  }): void => {
    this.increment("updates.installed", {
      version: payload.version ?? "unknown",
    });
    this.updateStats.installsInitiated++;
  };

  constructor(
    @inject(MAIN_TOKENS.AgentService)
    private readonly agentService: AgentService,
    @inject(MAIN_TOKENS.UpdatesService)
    private readonly updatesService: UpdatesService,
  ) {
    this.env = process.env.DD_ENV ?? "development";
    this.serviceTag = "posthog-code";
  }

  @postConstruct()
  init(): void {
    _instance = this;
    this.setupSocket();
    this.subscribeToAgentEvents();
    this.subscribeToUpdateEvents();
    log.info("Datadog telemetry initialized", { enabled: this.enabled });
  }

  @preDestroy()
  shutdown(): void {
    this.agentService.off(AgentServiceEvent.LlmActivity, this.onLlmActivity);
    this.agentService.off(AgentServiceEvent.SessionsIdle, this.onSessionsIdle);
    this.agentService.off(AgentServiceEvent.SessionEvent, this.onSessionEvent);
    this.updatesService.off(UpdatesEvent.Status, this.onUpdatesStatus);
    this.updatesService.off(UpdatesEvent.Ready, this.onUpdateReady);

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    _instance = null;
  }

  getStats(): TelemetryStatsOutput {
    return {
      agent: { ...this.agentStats },
      updates: { ...this.updateStats },
      eventsEmitted: this.eventsEmitted,
      statsdEnabled: this.enabled,
    };
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.send(`${this.metricName(name)}:1|c${this.formatTags(tags)}`);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.send(`${this.metricName(name)}:${value}|g${this.formatTags(tags)}`);
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.send(`${this.metricName(name)}:${value}|h${this.formatTags(tags)}`);
  }

  trackEvent(
    title: string,
    text: string,
    tags?: string[],
  ): void {
    const allTags = [
      `env:${this.env}`,
      `service:${this.serviceTag}`,
      ...(tags ?? []),
    ];
    const tagString = allTags.join(",");
    const msg = `_e{${title.length},${text.length}}:${title}|${text}|#${tagString}`;
    this.send(msg);
    this.eventsEmitted++;
  }

  private setupSocket(): void {
    const apiKey = process.env.DD_API_KEY;
    if (!apiKey) {
      log.info("DD_API_KEY not set; StatsD metrics disabled");
      return;
    }

    try {
      this.socket = dgram.createSocket("udp4");
      this.socket.on("error", (err) => {
        log.warn("StatsD socket error", { error: err.message });
      });
      this.enabled = true;
    } catch (err) {
      log.warn("Failed to create StatsD socket", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private subscribeToAgentEvents(): void {
    this.agentService.on(AgentServiceEvent.LlmActivity, this.onLlmActivity);
    this.agentService.on(AgentServiceEvent.SessionsIdle, this.onSessionsIdle);
    this.agentService.on(AgentServiceEvent.SessionEvent, this.onSessionEvent);
  }

  private subscribeToUpdateEvents(): void {
    this.updatesService.on(UpdatesEvent.Status, this.onUpdatesStatus);
    this.updatesService.on(UpdatesEvent.Ready, this.onUpdateReady);
  }

  private metricName(name: string): string {
    return `posthog_code.${name}`;
  }

  private formatTags(tags?: Record<string, string>): string {
    const defaultTags: Record<string, string> = {
      env: this.env,
      service: this.serviceTag,
    };
    const merged = { ...defaultTags, ...tags };
    const tagList = Object.entries(merged).map(([k, v]) => `${k}:${v}`);
    return tagList.length > 0 ? `|#${tagList.join(",")}` : "";
  }

  private send(payload: string): void {
    if (!this.socket || !this.enabled) return;
    const buf = Buffer.from(payload);
    if (buf.length > MAX_BUFFER_SIZE) {
      log.warn("StatsD payload too large, skipping", { size: buf.length });
      return;
    }
    this.socket.send(buf, STATSD_PORT, STATSD_HOST, (err) => {
      if (err) {
        log.warn("StatsD send error", { error: err.message });
      }
    });
  }
}

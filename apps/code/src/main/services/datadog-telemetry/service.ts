import { randomUUID } from "node:crypto";
import * as dgram from "node:dgram";
import { inject, injectable, postConstruct, preDestroy } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { AgentServiceEvent } from "../agent/schemas";
import type { AgentService } from "../agent/service";
import { UpdatesEvent } from "../updates/schemas";
import type { UpdatesService } from "../updates/service";
import type { TelemetryStatsOutput, TelemetryTags } from "./schemas";

const log = logger.scope("datadog-telemetry");

const STATSD_HOST = "localhost";
const STATSD_PORT = 8125;
const MAX_BUFFER_SIZE = 1400;
const MAX_RECENT_EVENTS = 200;

interface ActiveSpan {
  name: string;
  startedAt: number;
  tags: Record<string, string>;
}

interface TrackedDatadogEvent {
  title: string;
  timestamp: number;
}

export interface DatadogSpanHandle {
  spanId: string;
}

let _instance: DatadogTelemetryService | null = null;

export function getDatadogTelemetry(): DatadogTelemetryService | null {
  return _instance;
}

export function trackInDatadog(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  _instance?.increment(`app.event.${eventName}`, properties);
}

@injectable()
export class DatadogTelemetryService {
  private socket: dgram.Socket | null = null;
  private enabled = false;
  private readonly env: string;
  private readonly serviceTag: string;

  private readonly spans = new Map<string, ActiveSpan>();
  private readonly recentEvents: TrackedDatadogEvent[] = [];
  private metricCalls = 0;
  private errorMetricCalls = 0;

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

  private cbfStats = {
    blueprintRefreshes: 0,
    blueprintSelections: 0,
    growthCycles: 0,
    domainCoverageScore: null as number | null,
    buildsStarted: 0,
    buildsCompleted: 0,
    buildFailures: 0,
    buildIterations: 0,
    lastBuildDurationMs: null as number | null,
    sessionsStarted: 0,
    sessionsEnded: 0,
    sessionFailures: 0,
  };

  private eventsEmitted = 0;

  private readonly onLlmActivity = (): void => {
    this.agentStats.llmActivityCount += 1;
    this.increment("agent.llm.activity");
  };

  private readonly onSessionsIdle = (): void => {
    this.increment("agent.sessions.idle");
  };

  private readonly onSessionEvent = (payload: {
    taskRunId: string;
    payload: unknown;
  }): void => {
    const message = payload.payload as {
      type?: string;
      durationMs?: number;
      duration_ms?: number;
    };

    if (message.type === "session_started") {
      this.agentStats.sessionsStarted += 1;
      this.increment("agent.sessions.started");
      return;
    }

    if (message.type === "session_ended" || message.type === "session_stopped") {
      this.agentStats.sessionsEnded += 1;
      const durationMs = Number(message.durationMs ?? message.duration_ms);
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        this.agentStats.lastSessionDurationMs = durationMs;
      }
      this.increment("agent.sessions.ended");
      return;
    }

    if (message.type === "session_error") {
      this.agentStats.sessionErrors += 1;
      this.increment("agent.sessions.error");
    }
  };

  private readonly onUpdatesStatus = (payload: {
    checking: boolean;
    downloading?: boolean;
    updateReady?: boolean;
  }): void => {
    if (payload.checking && !payload.downloading) {
      this.updateStats.checksInitiated += 1;
      this.increment("updates.check.started");
    }

    if (payload.downloading) {
      this.increment("updates.downloading");
    }

    if (payload.updateReady) {
      this.updateStats.downloadsStarted += 1;
      this.increment("updates.ready");
    }
  };

  private readonly onUpdateReady = (payload: {
    version: string | null;
  }): void => {
    this.updateStats.installsInitiated += 1;
    this.increment("updates.install.initiated", {
      version: payload.version ?? "unknown",
    });
  };

  constructor(
    @inject(MAIN_TOKENS.AgentService)
    private readonly agentService: AgentService,
    @inject(MAIN_TOKENS.UpdatesService)
    private readonly updatesService: UpdatesService,
  ) {
    this.env = process.env.DD_ENV ?? "development";
    this.serviceTag = process.env.DD_SERVICE ?? "posthog-code";
  }

  @postConstruct()
  public init(): void {
    _instance = this;
    this.setupSocket();
    this.subscribeToAgentEvents();
    this.subscribeToUpdateEvents();
    log.info("Datadog telemetry initialized", { enabled: this.enabled });
  }

  @preDestroy()
  public shutdown(): void {
    this.agentService.off(AgentServiceEvent.LlmActivity, this.onLlmActivity);
    this.agentService.off(AgentServiceEvent.SessionsIdle, this.onSessionsIdle);
    this.agentService.off(AgentServiceEvent.SessionEvent, this.onSessionEvent);
    this.updatesService.off(UpdatesEvent.Status, this.onUpdatesStatus);
    this.updatesService.off(UpdatesEvent.Ready, this.onUpdateReady);

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.spans.clear();
    _instance = null;
  }

  public getStats(): TelemetryStatsOutput {
    return {
      agent: { ...this.agentStats },
      updates: { ...this.updateStats },
      cbf: { ...this.cbfStats },
      eventsEmitted: this.eventsEmitted,
      statsdEnabled: this.enabled,
    };
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
        : Number(((this.errorMetricCalls / this.metricCalls) * 100).toFixed(2));
    const lastEvent = this.recentEvents[this.recentEvents.length - 1];

    return {
      activeAlerts,
      errorRate,
      apmHealthy: activeAlerts === 0,
      recentEventCount: this.recentEvents.length,
      lastEventAt: lastEvent ? new Date(lastEvent.timestamp).toISOString() : null,
    };
  }

  public startSpan(name: string, tags?: TelemetryTags): DatadogSpanHandle {
    const spanId = randomUUID();
    this.spans.set(spanId, {
      name,
      startedAt: Date.now(),
      tags: this.normalizeTags(tags),
    });
    return { spanId };
  }

  public endSpan(span: DatadogSpanHandle | string): void {
    const spanId = typeof span === "string" ? span : span.spanId;
    this.spans.delete(spanId);
  }

  public incrementMetric(name: string, tags?: TelemetryTags): void {
    this.increment(name, tags);
  }

  public increment(name: string, tags?: TelemetryTags): void {
    const normalized = this.normalizeTags(tags);
    this.recordMetric(name, normalized);
    this.recordCbfMetric(name, "increment", 1, normalized);
    this.send(`${this.metricName(name)}:1|c${this.formatTags(normalized)}`);
  }

  public gauge(name: string, value: number, tags?: TelemetryTags): void {
    const normalized = this.normalizeTags(tags);
    this.recordMetric(name, normalized);
    this.recordCbfMetric(name, "gauge", value, normalized);
    this.send(`${this.metricName(name)}:${value}|g${this.formatTags(normalized)}`);
  }

  public histogram(name: string, value: number, tags?: TelemetryTags): void {
    const normalized = this.normalizeTags(tags);
    this.recordMetric(name, normalized);
    this.recordCbfMetric(name, "histogram", value, normalized);
    this.send(`${this.metricName(name)}:${value}|h${this.formatTags(normalized)}`);
  }

  public async trackEvent(
    title: string,
    text: string,
    tags?: TelemetryTags | string[],
  ): Promise<void> {
    const normalized = this.normalizeTags(tags);
    const tagsForEvent = this.formatTagEntries(normalized).join(",");
    const message = `_e{${title.length},${text.length}}:${title}|${text}|#${tagsForEvent}`;
    this.send(message);
    this.eventsEmitted += 1;
    this.recordEvent(title);
  }

  private setupSocket(): void {
    if (!process.env.DD_API_KEY) {
      log.info("DD_API_KEY not set; StatsD metrics disabled");
      return;
    }

    try {
      this.socket = dgram.createSocket("udp4");
      this.socket.on("error", (error) => {
        log.warn("StatsD socket error", { error: error.message });
      });
      this.enabled = true;
    } catch (error) {
      log.warn("Failed to create StatsD socket", {
        error: error instanceof Error ? error.message : String(error),
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

  private formatTagEntries(tags?: Record<string, string>): string[] {
    const mergedTags = {
      env: this.env,
      service: this.serviceTag,
      ...(tags ?? {}),
    };
    return Object.entries(mergedTags).map(([key, value]) => `${key}:${value}`);
  }

  private formatTags(tags?: Record<string, string>): string {
    const tagEntries = this.formatTagEntries(tags);
    return tagEntries.length > 0 ? `|#${tagEntries.join(",")}` : "";
  }

  private normalizeTags(tags?: TelemetryTags | string[]): Record<string, string> {
    if (!tags) {
      return {};
    }

    if (Array.isArray(tags)) {
      const fromList: Record<string, string> = {};
      for (const tag of tags) {
        const separatorIndex = tag.indexOf(":");
        if (separatorIndex <= 0 || separatorIndex === tag.length - 1) {
          continue;
        }
        const key = tag.slice(0, separatorIndex);
        const value = tag.slice(separatorIndex + 1);
        fromList[key] = value;
      }
      return fromList;
    }

    return Object.fromEntries(
      Object.entries(tags).map(([key, value]) => [key, String(value)]),
    );
  }

  private recordMetric(name: string, tags: Record<string, string>): void {
    this.metricCalls += 1;
    if (
      name.includes("error") ||
      tags.status === "failed" ||
      tags.status === "error"
    ) {
      this.errorMetricCalls += 1;
    }
  }

  private recordEvent(title: string): void {
    this.recentEvents.push({
      title,
      timestamp: Date.now(),
    });
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.splice(0, this.recentEvents.length - MAX_RECENT_EVENTS);
    }
  }

  private recordCbfMetric(
    name: string,
    kind: "increment" | "gauge" | "histogram",
    value: number,
    tags: Record<string, string>,
  ): void {
    if (name === "cbf.pull.blueprint_refresh" && kind === "increment") {
      this.cbfStats.blueprintRefreshes += 1;
      return;
    }

    if (name === "cbf.pull.blueprint_select" && kind === "increment") {
      this.cbfStats.blueprintSelections += 1;
      return;
    }

    if (name === "cbf.fleet.growth_cycle" && kind === "increment") {
      this.cbfStats.growthCycles += 1;
      return;
    }

    if (name === "cbf.fleet.domain_coverage" && kind === "gauge") {
      this.cbfStats.domainCoverageScore = value;
      return;
    }

    if (name === "cbf.build.started" && kind === "increment") {
      this.cbfStats.buildsStarted += 1;
      return;
    }

    if (name === "cbf.build.completed" && kind === "increment") {
      this.cbfStats.buildsCompleted += 1;
      if (tags.status === "failure" || tags.status === "error") {
        this.cbfStats.buildFailures += 1;
      }
      return;
    }

    if (name === "cbf.build.iterate" && kind === "increment") {
      this.cbfStats.buildIterations += 1;
      return;
    }

    if (name === "cbf.build.duration_ms" && kind === "histogram") {
      this.cbfStats.lastBuildDurationMs = value;
      return;
    }

    if (name === "cbf.session.started" && kind === "increment") {
      this.cbfStats.sessionsStarted += 1;
      return;
    }

    if (name === "cbf.session.ended" && kind === "increment") {
      this.cbfStats.sessionsEnded += 1;
      if (tags.status === "failure" || tags.status === "error") {
        this.cbfStats.sessionFailures += 1;
      }
    }
  }

  private send(payload: string): void {
    if (!this.socket || !this.enabled) {
      return;
    }

    const buffer = Buffer.from(payload);
    if (buffer.length > MAX_BUFFER_SIZE) {
      log.warn("StatsD payload too large, skipping", { size: buffer.length });
      return;
    }

    this.socket.send(buffer, STATSD_PORT, STATSD_HOST, (error) => {
      if (error) {
        log.warn("StatsD send error", { error: error.message });
      }
    });
  }
}
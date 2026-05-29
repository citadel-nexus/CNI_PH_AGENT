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

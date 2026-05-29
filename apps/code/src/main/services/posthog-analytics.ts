import { PostHog } from "posthog-node";
import { getAppVersion } from "../utils/env";
import { logger } from "../utils/logger";
import { trackInDatadog } from "./datadog-telemetry/service";

const log = logger.scope("posthog-analytics-service");

const DATADOG_SITE = process.env.DD_SITE || "us5.datadoghq.com";
const DATADOG_API_KEY = process.env.DD_API_KEY;
const DATADOG_ENV = process.env.DD_ENV || "prod";
const DATADOG_SERVICE = process.env.DD_SERVICE || "citadel-posthog-code";
const MAX_RECENT_EVENTS = 50;

export interface RecentEvent {
  eventName: string;
  timestamp: string;
  properties: Record<string, string | number | boolean>;
}

let posthogClient: PostHog | null = null;
let currentUserId: string | null = null;
const recentEvents: RecentEvent[] = [];

export function initializePostHog(): PostHog | null {
  if (posthogClient) {
    return posthogClient;
  }

  const apiKey = process.env.VITE_POSTHOG_API_KEY;
  const apiHost = process.env.VITE_POSTHOG_API_HOST;
  if (!apiKey) {
    return null;
  }

  posthogClient = new PostHog(apiKey, {
    host: apiHost || "https://internal-c.posthog.com",
    enableExceptionAutocapture: true,
  });
  return posthogClient;
}

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function trackAppEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  const distinctId = currentUserId || "anonymous-app-event";
  const eventProperties = {
    team: "posthog-code",
    ...properties,
    app_version: getAppVersion(),
    $process_person_profile: !!currentUserId,
  };

  if (posthogClient) {
    posthogClient.capture({
      distinctId,
      event: eventName,
      properties: eventProperties,
    });
  }

  trackInDatadog(eventName, eventProperties);
  recordRecentEvent(eventName, eventProperties);
  void forwardAppEventToDatadog(eventName, eventProperties);
}

export function getRecentEvents(limit = 20): RecentEvent[] {
  const normalizedLimit = Math.max(1, limit);
  return recentEvents.slice(-normalizedLimit).reverse();
}

export function getRecentTrackedEvents(limit = 20): RecentEvent[] {
  return getRecentEvents(limit);
}

export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!posthogClient) {
    return;
  }

  currentUserId = userId;
  posthogClient.identify({
    distinctId: userId,
    properties,
  });
}

export async function shutdownPostHog(): Promise<void> {
  if (!posthogClient) {
    return;
  }

  await posthogClient.shutdown();
  posthogClient = null;
}

export function getPostHogClient(): PostHog | null {
  return posthogClient;
}

export function resetUser(): void {
  currentUserId = null;
}

export async function forwardAppEventToDatadog(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!DATADOG_API_KEY) {
    return;
  }

  const endpoint = `https://api.${DATADOG_SITE}/api/v1/events`;
  const tags = {
    env: DATADOG_ENV,
    service: DATADOG_SERVICE,
    source: "posthog-analytics",
    event_name: eventName,
    ...(properties ?? {}),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": DATADOG_API_KEY,
      },
      body: JSON.stringify({
        title: `PostHog app event: ${eventName}`,
        text: JSON.stringify(properties ?? {}, null, 2),
        alert_type: "info",
        source_type_name: "posthog-code",
        tags: Object.entries(tags).map(([key, value]) => `${key}:${value}`),
      }),
    });

    if (!response.ok) {
      log.warn("Failed to forward app event to Datadog", {
        eventName,
        status: response.status,
      });
    }
  } catch (error) {
    log.warn("Error forwarding app event to Datadog", {
      eventName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function captureException(
  error: unknown,
  additionalProperties?: Record<string, unknown>,
): void {
  if (!posthogClient) {
    return;
  }

  const distinctId = currentUserId || "anonymous-app-event";
  posthogClient.captureException(error, distinctId, {
    team: "posthog-code",
    ...additionalProperties,
    app_version: getAppVersion(),
  });

  void forwardAppEventToDatadog("main_exception", {
    app_version: getAppVersion(),
    message: error instanceof Error ? error.message : String(error),
    has_additional_properties: !!additionalProperties,
  });
}

function recordRecentEvent(
  eventName: string,
  properties: Record<string, string | number | boolean>,
): void {
  recentEvents.push({
    eventName,
    timestamp: new Date().toISOString(),
    properties,
  });
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
  }
}

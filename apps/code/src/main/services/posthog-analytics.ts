import { PostHog } from "posthog-node";
import { getAppVersion } from "../utils/env";
import { trackInDatadog } from "./datadog-telemetry/service";

let posthogClient: PostHog | null = null;
let currentUserId: string | null = null;

const MAX_RECENT_EVENTS = 50;

export interface RecentEvent {
  name: string;
  timestamp: string;
  properties?: Record<string, string | number | boolean>;
}

const recentEvents: RecentEvent[] = [];

export function initializePostHog() {
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

export function setCurrentUserId(userId: string | null) {
  currentUserId = userId;
}

export function getCurrentUserId() {
  return currentUserId;
}

export function trackAppEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
) {
  if (!posthogClient) {
    return;
  }

  const distinctId = currentUserId || "anonymous-app-event";

  posthogClient.capture({
    distinctId,
    event: eventName,
    properties: {
      team: "posthog-code",
      ...properties,
      app_version: getAppVersion(),
      $process_person_profile: !!currentUserId,
    },
  });

  trackInDatadog(eventName, properties);

  recentEvents.unshift({
    name: eventName,
    timestamp: new Date().toISOString(),
    properties,
  });
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(MAX_RECENT_EVENTS);
  }
}

export function getRecentEvents(): RecentEvent[] {
  return recentEvents.slice();
}

export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean>,
) {
  if (!posthogClient) {
    return;
  }

  currentUserId = userId;

  posthogClient.identify({
    distinctId: userId,
    properties,
  });
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}

export function getPostHogClient() {
  return posthogClient;
}

export function resetUser() {
  currentUserId = null;
}

export function captureException(
  error: unknown,
  additionalProperties?: Record<string, unknown>,
) {
  if (!posthogClient) {
    return;
  }

  const distinctId = currentUserId || "anonymous-app-event";
  posthogClient.captureException(error, distinctId, {
    team: "posthog-code",
    ...additionalProperties,
    app_version: getAppVersion(),
  });
}

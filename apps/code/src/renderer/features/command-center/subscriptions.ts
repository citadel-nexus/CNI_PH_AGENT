import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { useCommandCenterStore } from "./stores/commandCenterStore";

const log = logger.scope("command-center-subscriptions");
const DATADOG_POLL_INTERVAL_MS = 30_000;
const EXTERNAL_POLL_INTERVAL_MS = 60_000;

async function refreshDatadogAndPosthog(): Promise<void> {
  const [datadogStatus, recentEvents] = await Promise.all([
    trpcClient.datadogTelemetry.getDashboardStatus.query(),
    trpcClient.analytics.getRecentEvents.query({ limit: 12 }),
  ]);

  useCommandCenterStore.getState().setDatadogSnapshot(datadogStatus);
  useCommandCenterStore.getState().setPosthogSnapshot({
    recentEvents: recentEvents.map((event) => ({
      eventName: event.eventName,
      timestamp: event.timestamp,
    })),
  });
  useCommandCenterStore.getState().setLastRefreshAt(new Date().toISOString());
}

async function refreshLinearAndN8n(): Promise<void> {
  const [
    activeIssues,
    projectStatus,
    recentUpdates,
    workflows,
    recentExecutions,
    errorCount,
  ] = await Promise.all([
    trpcClient.linearIntegration.getActiveIssues.query(),
    trpcClient.linearIntegration.getProjectStatus.query(),
    trpcClient.linearIntegration.getRecentUpdates.query(),
    trpcClient.n8nIntegration.getWorkflows.query(),
    trpcClient.n8nIntegration.getRecentExecutions.query(),
    trpcClient.n8nIntegration.getErrorCount.query(),
  ]);

  useCommandCenterStore.getState().setLinearSnapshot({
    activeIssues: activeIssues.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      state: issue.state,
    })),
    projectStatus: projectStatus.map((project) => ({
      id: project.id,
      name: project.name,
      progress: project.progress,
      state: project.state,
    })),
    recentUpdates: recentUpdates.map((update) => ({
      id: update.id,
      identifier: update.identifier,
      title: update.title,
      updatedAt: update.updatedAt,
    })),
  });

  useCommandCenterStore.getState().setN8nSnapshot({
    workflows: workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      updatedAt: workflow.updatedAt,
    })),
    recentExecutions: recentExecutions.map((execution) => ({
      id: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
      stoppedAt: execution.stoppedAt,
    })),
    errorCount: errorCount.count,
  });

  useCommandCenterStore.getState().setLastRefreshAt(new Date().toISOString());
}

export function registerCommandCenterSubscriptions(): () => void {
  let disposed = false;

  const runDatadogPoll = () => {
    if (disposed) return;
    refreshDatadogAndPosthog().catch((error) => {
      log.warn("Failed to refresh Datadog/PostHog panel data", { error });
    });
  };

  const runExternalPoll = () => {
    if (disposed) return;
    refreshLinearAndN8n().catch((error) => {
      log.warn("Failed to refresh Linear/n8n panel data", { error });
    });
  };

  runDatadogPoll();
  runExternalPoll();

  const datadogInterval = setInterval(runDatadogPoll, DATADOG_POLL_INTERVAL_MS);
  const externalInterval = setInterval(
    runExternalPoll,
    EXTERNAL_POLL_INTERVAL_MS,
  );

  return () => {
    disposed = true;
    clearInterval(datadogInterval);
    clearInterval(externalInterval);
  };
}

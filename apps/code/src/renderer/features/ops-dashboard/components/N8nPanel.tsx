import { useSettingsDialogStore } from "@features/settings/stores/settingsDialogStore";
import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { IntegrationCta } from "./IntegrationCta";
import { PanelCard } from "./PanelCard";

function statusColor(
  status: string,
): "green" | "red" | "blue" | "yellow" | "gray" {
  if (status === "success") return "green";
  if (status === "error") return "red";
  if (status === "running") return "blue";
  if (status === "waiting") return "yellow";
  return "gray";
}

export function N8nPanel() {
  const trpc = useTRPC();
  const openSettings = useSettingsDialogStore((state) => state.open);

  const {
    data: workflows,
    isError: isWorkflowsError,
    isLoading: isWorkflowsLoading,
  } = useQuery(
    trpc.n8nIntegration.getWorkflows.queryOptions(undefined, {
      refetchInterval: 60_000,
    }),
  );

  const {
    data: executions,
    isError: isExecutionsError,
    isLoading: isExecutionsLoading,
  } = useQuery(
    trpc.n8nIntegration.getRecentExecutions.queryOptions(undefined, {
      refetchInterval: 30_000,
    }),
  );

  const isLoading = isWorkflowsLoading || isExecutionsLoading;
  const isUnavailable =
    isWorkflowsError ||
    isExecutionsError ||
    (!isLoading &&
      (workflows?.length ?? 0) === 0 &&
      (executions?.length ?? 0) === 0);

  const activeCount = workflows?.filter((workflow) => workflow.active).length ?? 0;
  const workflowNameById = new Map(
    (workflows ?? []).map((workflow) => [workflow.id, workflow.name]),
  );

  const badge = (
    <Badge color={isUnavailable ? "gray" : "purple"} variant="soft" size="1">
      {isUnavailable ? "Not connected" : `${activeCount} active`}
    </Badge>
  );

  return (
    <PanelCard title="n8n" subtitle="Workflow executions" badge={badge}>
      {isLoading || !executions || !workflows ? (
        <Text className="text-[12px] text-[--gray-10]">Loading…</Text>
      ) : isUnavailable ? (
        <IntegrationCta
          message="Configure n8n API connection to see workflows here."
          actionLabel="Open Settings"
          onAction={() => openSettings("advanced")}
        />
      ) : executions.length === 0 ? (
        <Text className="text-[12px] text-[--gray-10]">No recent executions</Text>
      ) : (
        <Flex direction="column" gap="1">
          {executions.map((execution) => {
            const workflowName = execution.workflowId
              ? workflowNameById.get(execution.workflowId) || execution.workflowId
              : "Unknown workflow";

            return (
              <Flex
                key={execution.id}
                align="center"
                justify="between"
                className="gap-2 border-b border-[--gray-a3] py-1 last:border-0"
              >
                <Text className="min-w-0 truncate text-[11px]">{workflowName}</Text>
                <Flex align="center" gap="2" className="shrink-0">
                  <Badge color={statusColor(execution.status)} variant="soft" size="1">
                    {execution.status}
                  </Badge>
                  <Text className="text-[10px] text-[--gray-10]">
                    {execution.startedAt
                      ? new Date(execution.startedAt).toLocaleTimeString()
                      : "n/a"}
                  </Text>
                </Flex>
              </Flex>
            );
          })}
        </Flex>
      )}
    </PanelCard>
  );
}
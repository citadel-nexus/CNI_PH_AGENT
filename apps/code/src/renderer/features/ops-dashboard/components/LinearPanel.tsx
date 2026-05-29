import { useSettingsDialogStore } from "@features/settings/stores/settingsDialogStore";
import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { IntegrationCta } from "./IntegrationCta";
import { PanelCard } from "./PanelCard";

const PRIORITY_LABEL: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

function priorityColor(
  priority: number | null,
): "red" | "orange" | "yellow" | "gray" | "blue" {
  if (priority === 1) return "red";
  if (priority === 2) return "orange";
  if (priority === 3) return "yellow";
  if (priority === 4) return "blue";
  return "gray";
}

function priorityLabel(priority: number | null): string {
  if (priority === null) {
    return "No priority";
  }
  return PRIORITY_LABEL[priority] ?? `P${priority}`;
}

export function LinearPanel() {
  const trpc = useTRPC();
  const openSettings = useSettingsDialogStore((state) => state.open);

  const {
    data: projectStatus,
    isError: isProjectStatusError,
    isLoading: isProjectStatusLoading,
  } = useQuery(
    trpc.linearIntegration.getProjectStatus.queryOptions(undefined, {
      refetchInterval: 60_000,
    }),
  );

  const {
    data: issues,
    isError: isIssuesError,
    isLoading: isIssuesLoading,
  } = useQuery(
    trpc.linearIntegration.getActiveIssues.queryOptions(undefined, {
      refetchInterval: 60_000,
    }),
  );

  const isLoading = isProjectStatusLoading || isIssuesLoading;
  const isUnavailable =
    isProjectStatusError ||
    isIssuesError ||
    (!isLoading &&
      (projectStatus?.length ?? 0) === 0 &&
      (issues?.length ?? 0) === 0);

  const badge = (
    <Badge color={isUnavailable ? "gray" : "blue"} variant="soft" size="1">
      {isUnavailable ? "Not connected" : `${projectStatus?.length ?? 0} projects`}
    </Badge>
  );

  const primaryProject = projectStatus?.[0];

  return (
    <PanelCard
      title="Linear"
      subtitle={primaryProject?.name || "Issue tracker"}
      badge={badge}
    >
      {isLoading || !issues || !projectStatus ? (
        <Text className="text-[12px] text-[--gray-10]">Loading…</Text>
      ) : isUnavailable ? (
        <IntegrationCta
          message="Connect Linear in Settings to see issues here."
          actionLabel="Open Settings"
          onAction={() => openSettings("advanced")}
        />
      ) : issues.length === 0 ? (
        <Text className="text-[12px] text-[--gray-10]">No active issues</Text>
      ) : (
        <Flex direction="column" gap="1">
          {primaryProject ? (
            <Flex direction="column" gap="1" className="mb-2">
              <Text className="text-[11px] font-semibold uppercase text-[--gray-9]">
                Primary project
              </Text>
              <Text className="truncate text-[11px]">{primaryProject.name}</Text>
              <Text className="text-[10px] text-[--gray-10]">
                State: {primaryProject.state ?? "unknown"}
              </Text>
            </Flex>
          ) : null}

          {issues.slice(0, 10).map((issue) => (
            <Flex
              key={issue.id}
              align="start"
              justify="between"
              className="gap-2 border-b border-[--gray-a3] py-1 last:border-0"
            >
              <Flex direction="column" className="min-w-0">
                <Text className="truncate text-[11px] font-medium">
                  {issue.identifier}
                </Text>
                <Text className="truncate text-[11px] text-[--gray-11]">
                  {issue.title}
                </Text>
              </Flex>
              <Badge
                color={priorityColor(issue.priority)}
                variant="soft"
                size="1"
                className="shrink-0"
              >
                {priorityLabel(issue.priority)}
              </Badge>
            </Flex>
          ))}
        </Flex>
      )}
    </PanelCard>
  );
}
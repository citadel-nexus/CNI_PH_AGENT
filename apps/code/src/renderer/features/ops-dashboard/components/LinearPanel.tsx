import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Progress, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { PanelCard } from "./PanelCard";

const PRIORITY_LABEL: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

function priorityColor(
  p: number,
): "red" | "orange" | "yellow" | "gray" | "blue" {
  if (p === 1) return "red";
  if (p === 2) return "orange";
  if (p === 3) return "yellow";
  if (p === 4) return "blue";
  return "gray";
}

export function LinearPanel() {
  const trpc = useTRPC();
  const { data: status } = useQuery(
    trpc.linearIntegration.getProjectStatus.queryOptions(undefined, {
      refetchInterval: 60_000,
    }),
  );
  const { data: issues, isLoading } = useQuery(
    trpc.linearIntegration.getActiveIssues.queryOptions(undefined, {
      refetchInterval: 60_000,
    }),
  );

  const badge = status?.activeCycle ? (
    <Badge color="blue" variant="soft" size="1">
      {status.activeCycle.percentComplete}%
    </Badge>
  ) : null;

  return (
    <PanelCard title="Linear" subtitle={status?.teamName} badge={badge}>
      {status?.activeCycle && (
        <Flex direction="column" gap="1" className="mb-3">
          <Flex justify="between" align="center">
            <Text className="text-[11px] font-semibold uppercase text-[--gray-9]">
              Current cycle
            </Text>
            <Text className="text-[11px] text-[--gray-10]">
              {status.activeCycle.completedIssueCount}/
              {status.activeCycle.issueCount}
            </Text>
          </Flex>
          <Progress
            value={status.activeCycle.percentComplete}
            size="1"
          />
          <Flex justify="between">
            <Text className="text-[10px] text-[--gray-10]">
              Open: {status.openIssueCount}
            </Text>
            <Text className="text-[10px] text-[--gray-10]">
              In progress: {status.inProgressCount}
            </Text>
          </Flex>
        </Flex>
      )}

      {isLoading || !issues ? (
        <Text className="text-[12px] text-[--gray-10]">Loading…</Text>
      ) : issues.issues.length === 0 ? (
        <Text className="text-[12px] text-[--gray-10]">No active issues</Text>
      ) : (
        <Flex direction="column" gap="1">
          {issues.issues.slice(0, 10).map((issue) => (
            <Flex
              key={issue.id}
              align="start"
              justify="between"
              className="gap-2 border-b border-[--gray-a3] py-1 last:border-0"
            >
              <Text className="min-w-0 truncate text-[11px]">
                {issue.title}
              </Text>
              <Badge
                color={priorityColor(issue.priority)}
                variant="soft"
                size="1"
                className="shrink-0"
              >
                {PRIORITY_LABEL[issue.priority] ?? "P" + issue.priority}
              </Badge>
            </Flex>
          ))}
        </Flex>
      )}
    </PanelCard>
  );
}

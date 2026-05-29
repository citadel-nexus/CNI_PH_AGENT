import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { PanelCard } from "./PanelCard";

function statusColor(
  s: string,
): "green" | "red" | "blue" | "yellow" | "gray" {
  if (s === "success") return "green";
  if (s === "error") return "red";
  if (s === "running") return "blue";
  if (s === "waiting") return "yellow";
  return "gray";
}

export function N8nPanel() {
  const trpc = useTRPC();
  const { data: workflows } = useQuery(
    trpc.n8nIntegration.getWorkflows.queryOptions(undefined, {
      refetchInterval: 60_000,
    }),
  );
  const { data: executions, isLoading } = useQuery(
    trpc.n8nIntegration.getRecentExecutions.queryOptions(
      { limit: 20 },
      { refetchInterval: 30_000 },
    ),
  );

  const activeCount = workflows?.workflows.filter((w) => w.active).length ?? 0;
  const badge = (
    <Badge color="purple" variant="soft" size="1">
      {activeCount} active
    </Badge>
  );

  return (
    <PanelCard title="n8n" subtitle="Workflow executions" badge={badge}>
      {isLoading || !executions ? (
        <Text className="text-[12px] text-[--gray-10]">Loading…</Text>
      ) : executions.executions.length === 0 ? (
        <Text className="text-[12px] text-[--gray-10]">No recent executions</Text>
      ) : (
        <Flex direction="column" gap="1">
          {executions.executions.map((ex) => (
            <Flex
              key={ex.id}
              align="center"
              justify="between"
              className="gap-2 border-b border-[--gray-a3] py-1 last:border-0"
            >
              <Text className="min-w-0 truncate text-[11px]">
                {ex.workflowName || ex.workflowId}
              </Text>
              <Flex align="center" gap="2" className="shrink-0">
                <Badge color={statusColor(ex.status)} variant="soft" size="1">
                  {ex.status}
                </Badge>
                <Text className="text-[10px] text-[--gray-10]">
                  {new Date(ex.startedAt).toLocaleTimeString()}
                </Text>
              </Flex>
            </Flex>
          ))}
        </Flex>
      )}
    </PanelCard>
  );
}

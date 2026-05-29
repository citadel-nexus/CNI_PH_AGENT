import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { PanelCard } from "./PanelCard";

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <Flex justify="between" align="center" className="py-1">
      <Text className="text-[12px] text-[--gray-11]">{label}</Text>
      <Text className="font-mono text-[12px] font-medium">{value}</Text>
    </Flex>
  );
}

export function DatadogPanel() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.datadogTelemetry.getStats.queryOptions(undefined, {
      refetchInterval: 10_000,
    }),
  );

  const badge = (
    <Badge
      color={data?.statsdEnabled ? "green" : "gray"}
      variant="soft"
      size="1"
    >
      {data?.statsdEnabled ? "StatsD on" : "StatsD off"}
    </Badge>
  );

  return (
    <PanelCard title="Datadog" subtitle="In-process metrics" badge={badge}>
      {isLoading || !data ? (
        <Text className="text-[12px] text-[--gray-10]">Loading…</Text>
      ) : (
        <Flex direction="column" gap="1">
          <Text className="mb-1 text-[11px] font-semibold uppercase text-[--gray-9]">
            Agent
          </Text>
          <StatRow label="Sessions started" value={data.agent.sessionsStarted} />
          <StatRow label="Sessions ended" value={data.agent.sessionsEnded} />
          <StatRow label="Session errors" value={data.agent.sessionErrors} />
          <StatRow label="LLM activity" value={data.agent.llmActivityCount} />
          <StatRow label="Tool calls" value={data.agent.toolCallsTotal} />
          <Text className="mb-1 mt-3 text-[11px] font-semibold uppercase text-[--gray-9]">
            Updates
          </Text>
          <StatRow label="Checks initiated" value={data.updates.checksInitiated} />
          <StatRow label="Downloads started" value={data.updates.downloadsStarted} />
          <StatRow label="Installs initiated" value={data.updates.installsInitiated} />
          <Text className="mb-1 mt-3 text-[11px] font-semibold uppercase text-[--gray-9]">
            Events
          </Text>
          <StatRow label="Events emitted" value={data.eventsEmitted} />
        </Flex>
      )}
    </PanelCard>
  );
}

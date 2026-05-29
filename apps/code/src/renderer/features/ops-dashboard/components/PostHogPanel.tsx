import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { PanelCard } from "./PanelCard";

export function PostHogPanel() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.analytics.getRecentEvents.queryOptions(undefined, {
      refetchInterval: 15_000,
    }),
  );

  const count = data?.length ?? 0;
  const badge = (
    <Badge color="orange" variant="soft" size="1">
      {count} events
    </Badge>
  );

  return (
    <PanelCard
      title="PostHog"
      subtitle="Recent in-process events"
      badge={badge}
    >
      {isLoading || !data ? (
        <Text className="text-[12px] text-[--gray-10]">Loading…</Text>
      ) : data.length === 0 ? (
        <Text className="text-[12px] text-[--gray-10]">No events yet</Text>
      ) : (
        <Flex direction="column" gap="1">
          {data.map((ev, i) => (
            <Flex
              key={`${ev.name}-${i}`}
              justify="between"
              align="start"
              className="gap-2 border-b border-[--gray-a3] py-1 last:border-0"
            >
              <Text className="min-w-0 truncate text-[11px] font-medium">
                {ev.name}
              </Text>
              <Text className="shrink-0 text-[10px] text-[--gray-9]">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </PanelCard>
  );
}

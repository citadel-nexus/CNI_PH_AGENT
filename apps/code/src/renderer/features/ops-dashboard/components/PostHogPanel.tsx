import { useSettingsDialogStore } from "@features/settings/stores/settingsDialogStore";
import { useTRPC } from "@renderer/trpc/client";
import { Badge, Flex, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { IntegrationCta } from "./IntegrationCta";
import { PanelCard } from "./PanelCard";

export function PostHogPanel() {
  const trpc = useTRPC();
  const openSettings = useSettingsDialogStore((state) => state.open);

  const { data, isError, isLoading } = useQuery(
    trpc.analytics.getRecentEvents.queryOptions(
      { limit: 20 },
      {
        refetchInterval: 15_000,
      },
    ),
  );

  const count = data?.length ?? 0;
  const isUnavailable = isError || (!isLoading && count === 0);

  const badge = (
    <Badge color={isUnavailable ? "gray" : "orange"} variant="soft" size="1">
      {isUnavailable ? "Not connected" : `${count} events`}
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
      ) : isUnavailable ? (
        <IntegrationCta
          message="Configure PostHog analytics in Settings to see events here."
          actionLabel="Open Settings"
          onAction={() => openSettings("advanced")}
        />
      ) : (
        <Flex direction="column" gap="1">
          {data.map((event, index) => (
            <Flex
              key={`${event.eventName}-${index}`}
              justify="between"
              align="start"
              className="gap-2 border-b border-[--gray-a3] py-1 last:border-0"
            >
              <Text className="min-w-0 truncate text-[11px] font-medium">
                {event.eventName}
              </Text>
              <Text className="shrink-0 text-[10px] text-[--gray-9]">
                {new Date(event.timestamp).toLocaleTimeString()}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </PanelCard>
  );
}

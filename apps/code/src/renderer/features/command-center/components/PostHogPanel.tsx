import { Badge, Flex, Text } from "@radix-ui/themes";
import { useCommandCenterStore } from "../stores/commandCenterStore";
import { PanelCard } from "./PanelCard";

export function PostHogPanel() {
  const recentEvents = useCommandCenterStore(
    (state) => state.posthogSnapshot.recentEvents,
  );

  return (
    <PanelCard title="PostHog" subtitle="Recent app analytics events">
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Events captured
          </Text>
          <Badge color="gray" variant="soft">
            {recentEvents.length}
          </Badge>
        </Flex>
        <div className="space-y-2">
          {recentEvents.length === 0 ? (
            <Text className="text-(--gray-10) text-xs">
              No events captured yet.
            </Text>
          ) : (
            recentEvents.slice(0, 5).map((event) => (
              <Flex
                key={`${event.eventName}:${event.timestamp}`}
                justify="between"
              >
                <Text className="truncate text-(--gray-12) text-xs">
                  {event.eventName}
                </Text>
                <Text className="text-(--gray-10) text-[11px]">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </Text>
              </Flex>
            ))
          )}
        </div>
      </Flex>
    </PanelCard>
  );
}

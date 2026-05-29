import { Flex, Text } from "@radix-ui/themes";
import { useCommandCenterStore } from "../stores/commandCenterStore";
import { PanelCard } from "./PanelCard";

export function DatadogPanel() {
  const snapshot = useCommandCenterStore((state) => state.datadogSnapshot);

  return (
    <PanelCard title="Datadog" subtitle="Alerts, error rate, and APM health">
      <Flex direction="column" gap="3">
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Active alerts
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.activeAlerts}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Error rate
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.errorRate.toFixed(2)}%
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            APM health
          </Text>
          <Text
            className={
              snapshot.apmHealthy
                ? "font-medium text-(--green-11)"
                : "font-medium text-(--red-11)"
            }
          >
            {snapshot.apmHealthy ? "Healthy" : "Degraded"}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Recent events
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.recentEventCount}
          </Text>
        </Flex>
      </Flex>
    </PanelCard>
  );
}

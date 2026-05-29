import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import { Lightning } from "@phosphor-icons/react";
import { Box, Flex, Switch, Text } from "@radix-ui/themes";
import { useMemo } from "react";
import {
  type CommandCenterPanelId,
  useCommandCenterStore,
} from "../stores/commandCenterStore";
import { DatadogPanel } from "./DatadogPanel";
import { LinearPanel } from "./LinearPanel";
import { N8nPanel } from "./N8nPanel";
import { PostHogPanel } from "./PostHogPanel";

export function CommandCenterView() {
  const panelVisibility = useCommandCenterStore(
    (state) => state.panelVisibility,
  );
  const panelOrder = useCommandCenterStore((state) => state.panelOrder);
  const setPanelVisibility = useCommandCenterStore(
    (state) => state.setPanelVisibility,
  );
  const lastRefreshAt = useCommandCenterStore((state) => state.lastRefreshAt);

  const panels: Record<CommandCenterPanelId, JSX.Element> = {
    datadog: <DatadogPanel />,
    posthog: <PostHogPanel />,
    linear: <LinearPanel />,
    n8n: <N8nPanel />,
  };

  const visiblePanels = panelOrder.filter((panel) => panelVisibility[panel]);

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <Lightning size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Command Center"
        >
          Command Center
        </Text>
      </Flex>
    ),
    [],
  );

  useSetHeaderContent(headerContent);

  return (
    <Flex direction="column" height="100%">
      <Flex
        align="center"
        justify="between"
        className="border-(--gray-a4) border-b px-4 py-3"
      >
        <Flex gap="4" align="center">
          {panelOrder.map((panelId) => (
            <Flex key={panelId} align="center" gap="2">
              <Switch
                checked={panelVisibility[panelId]}
                onCheckedChange={(checked) =>
                  setPanelVisibility(panelId, Boolean(checked))
                }
                size="1"
              />
              <Text className="text-(--gray-11) text-xs capitalize">
                {panelId}
              </Text>
            </Flex>
          ))}
        </Flex>
        <Text className="text-(--gray-10) text-xs">
          Last refresh:{" "}
          {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : "—"}
        </Text>
      </Flex>
      <Box className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visiblePanels.map((panelId) => (
            <div key={panelId} className="min-h-[180px]">
              {panels[panelId]}
            </div>
          ))}
        </div>
      </Box>
    </Flex>
  );
}

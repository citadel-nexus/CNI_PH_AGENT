import { Flex, Text } from "@radix-ui/themes";
import { useCommandCenterStore } from "../stores/commandCenterStore";
import { PanelCard } from "./PanelCard";

export function N8nPanel() {
  const snapshot = useCommandCenterStore((state) => state.n8nSnapshot);
  const activeWorkflows = snapshot.workflows.filter(
    (workflow) => workflow.active,
  );

  return (
    <PanelCard title="n8n" subtitle="Workflow activity and execution health">
      <Flex direction="column" gap="3">
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Active workflows
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {activeWorkflows.length}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Recent executions
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.recentExecutions.length}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Error executions
          </Text>
          <Text
            className={
              snapshot.errorCount > 0
                ? "font-medium text-(--red-11)"
                : "font-medium text-(--green-11)"
            }
          >
            {snapshot.errorCount}
          </Text>
        </Flex>
      </Flex>
    </PanelCard>
  );
}

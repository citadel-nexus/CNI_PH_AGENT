import { Flex, Text } from "@radix-ui/themes";
import { useCommandCenterStore } from "../stores/commandCenterStore";
import { PanelCard } from "./PanelCard";

export function LinearPanel() {
  const snapshot = useCommandCenterStore((state) => state.linearSnapshot);

  return (
    <PanelCard title="Linear" subtitle="Issue, project, and update status">
      <Flex direction="column" gap="3">
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Open issues
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.activeIssues.length}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Projects tracked
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.projectStatus.length}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text className="text-(--gray-10) text-xs uppercase tracking-wide">
            Recent updates
          </Text>
          <Text className="font-medium text-(--gray-12)">
            {snapshot.recentUpdates.length}
          </Text>
        </Flex>
        <div className="space-y-2">
          {snapshot.activeIssues.slice(0, 3).map((issue) => (
            <Text
              key={issue.id}
              className="truncate text-(--gray-11) text-xs"
              title={`${issue.identifier} ${issue.title}`}
            >
              {issue.identifier}: {issue.title}
            </Text>
          ))}
        </div>
      </Flex>
    </PanelCard>
  );
}

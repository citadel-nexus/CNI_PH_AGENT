import { usePluginSyncStore } from "@features/plugin-sync/stores/pluginSyncStore";
import { Button, Flex, Text } from "@radix-ui/themes";

function stateLabel(state: string | undefined): string {
  switch (state) {
    case "syncing":
      return "Syncing…";
    case "synced":
      return "Synced";
    case "error":
      return "Sync error";
    default:
      return "Idle";
  }
}

function stateColor(state: string | undefined): string {
  switch (state) {
    case "syncing":
      return "text-yellow-500";
    case "synced":
      return "text-green-500";
    case "error":
      return "text-red-500";
    default:
      return "text-gray-400";
  }
}

export function PluginSyncStatus() {
  const status = usePluginSyncStore((s) => s.status);
  const syncNow = usePluginSyncStore((s) => s.syncNow);
  const isSyncing = status?.state === "syncing";

  return (
    <Flex align="center" gap="2">
      <span className={`h-2 w-2 rounded-full ${stateColor(status?.state)}`} />
      <Text size="1" color="gray">
        {stateLabel(status?.state)}
        {status?.lastSyncAt
          ? ` · ${new Date(status.lastSyncAt).toLocaleTimeString()}`
          : ""}
        {status?.filesChanged ? ` · ${status.filesChanged} file(s)` : ""}
      </Text>
      <Button
        size="1"
        variant="ghost"
        disabled={isSyncing || !status?.enabled}
        onClick={syncNow}
      >
        Sync
      </Button>
    </Flex>
  );
}

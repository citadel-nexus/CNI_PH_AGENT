import type { SyncStatus } from "@main/services/plugin-sync/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { create } from "zustand";

const log = logger.scope("plugin-sync-store");

interface PluginSyncState {
  status: SyncStatus | null;
  setStatus: (status: SyncStatus) => void;
  syncNow: () => void;
}

export const usePluginSyncStore = create<PluginSyncState>()((set) => ({
  status: null,

  setStatus: (status) => set({ status }),

  syncNow: () => {
    trpcClient.pluginSync.syncNow.mutate().catch((err: unknown) => {
      log.error("syncNow failed", { error: err });
    });
  },
}));

export function initializePluginSyncStore() {
  trpcClient.pluginSync.getStatus
    .query()
    .then((status) => {
      usePluginSyncStore.setState({ status });
    })
    .catch((err: unknown) => {
      log.warn("Failed to fetch initial plugin sync status", { error: err });
    });
}

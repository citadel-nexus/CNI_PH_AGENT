import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { initializePluginSyncStore, usePluginSyncStore } from "./stores/pluginSyncStore";

const log = logger.scope("plugin-sync-subscriptions");

export function registerPluginSyncSubscriptions() {
  initializePluginSyncStore();

  const subscription = trpcClient.pluginSync.onStatus.subscribe(undefined, {
    onData: (status) => {
      usePluginSyncStore.getState().setStatus(status);
    },
    onError: (error) => {
      log.error("Plugin sync status subscription error", { error });
    },
  });

  return () => {
    subscription.unsubscribe();
  };
}

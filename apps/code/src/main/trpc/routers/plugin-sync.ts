import {
  getSyncHistoryOutput,
  syncNowOutput,
  syncStatus,
  toggleSyncInput,
  updateConfigInput,
  PluginSyncEvent,
  type PluginSyncEvents,
} from "../../services/plugin-sync/schemas";
import type { PluginSyncService } from "../../services/plugin-sync/service";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<PluginSyncService>(MAIN_TOKENS.PluginSyncService);

function subscribe<K extends keyof PluginSyncEvents>(event: K) {
  return publicProcedure.subscription(async function* (opts) {
    const service = getService();
    const iterable = service.toIterable(event, { signal: opts.signal });
    for await (const data of iterable) {
      yield data;
    }
  });
}

export const pluginSyncRouter = router({
  getStatus: publicProcedure.output(syncStatus).query(() => {
    return getService().getStatus();
  }),

  getHistory: publicProcedure.output(getSyncHistoryOutput).query(() => {
    return { entries: getService().getHistory() };
  }),

  syncNow: publicProcedure.output(syncNowOutput).mutation(() => {
    return getService().syncNow();
  }),

  updateConfig: publicProcedure.input(updateConfigInput).mutation(({ input }) => {
    getService().updateConfig(input);
  }),

  toggleSync: publicProcedure.input(toggleSyncInput).mutation(({ input }) => {
    if (input.enabled) {
      getService().startSync();
    } else {
      getService().stopSync();
    }
  }),

  onStatus: subscribe(PluginSyncEvent.Status),
  onFilesUpdated: subscribe(PluginSyncEvent.FilesUpdated),
});

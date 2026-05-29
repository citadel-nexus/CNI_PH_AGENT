import { z } from "zod";

export const syncConfig = z.object({
  repo: z.string().default("citadel-nexus/CNI_PH_AGENT"),
  branch: z.string().default("main"),
  intervalMs: z.number().int().min(10_000).default(60_000),
  paths: z.array(z.string()).default(["plugins/citadel"]),
  enabled: z.boolean().default(true),
});
export type SyncConfig = z.infer<typeof syncConfig>;

export const syncStatus = z.object({
  state: z.enum(["idle", "syncing", "synced", "error"]),
  lastSyncAt: z.number().nullable(),
  lastCommitSha: z.string().nullable(),
  filesChanged: z.number(),
  lastError: z.string().nullable(),
  enabled: z.boolean(),
});
export type SyncStatus = z.infer<typeof syncStatus>;

export const syncHistoryEntry = z.object({
  at: z.number(),
  commitSha: z.string().nullable(),
  filesChanged: z.number(),
  durationMs: z.number(),
  status: z.enum(["success", "error"]),
  error: z.string().nullable(),
});
export type SyncHistoryEntry = z.infer<typeof syncHistoryEntry>;

export const getSyncHistoryOutput = z.object({
  entries: z.array(syncHistoryEntry),
});

export const syncNowOutput = z.object({
  started: z.boolean(),
});

export const updateConfigInput = syncConfig.partial();
export type UpdateConfigInput = z.infer<typeof updateConfigInput>;

export const toggleSyncInput = z.object({
  enabled: z.boolean(),
});

export const PluginSyncEvent = {
  Status: "status",
  FilesUpdated: "files-updated",
} as const;

export interface PluginSyncEvents {
  [PluginSyncEvent.Status]: SyncStatus;
  [PluginSyncEvent.FilesUpdated]: { paths: string[]; commitSha: string };
}

export interface PersistedSyncState {
  lastCommitSha: string | null;
  config: SyncConfig;
}

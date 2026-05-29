import * as fs from "node:fs";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";
import type { IStoragePaths } from "@posthog/platform/storage-paths";
import { inject, injectable, postConstruct, preDestroy } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import {
  PluginSyncEvent,
  type PersistedSyncState,
  type PluginSyncEvents,
  type SyncConfig,
  type SyncHistoryEntry,
  type SyncStatus,
  type UpdateConfigInput,
  syncConfig as syncConfigSchema,
} from "./schemas";

const log = logger.scope("plugin-sync");

const MAX_HISTORY = 50;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

interface GitHubCommit {
  sha: string;
}

interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

interface GitHubTree {
  sha: string;
  tree: GitHubTreeItem[];
}

interface InstalledPluginsFile {
  version: number;
  plugins: Record<string, Array<{ scope: string; installPath: string; version: string }>>;
}

class GitHubHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    body: string,
  ) {
    super(`GitHub API ${statusCode}: ${body.slice(0, 200)}`);
    this.name = "GitHubHttpError";
  }
}

function httpsGet(url: string, token?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const reqOptions = {
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: "GET",
      headers: {
        "User-Agent": "posthog-code-plugin-sync/1.0",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = https.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode && res.statusCode >= 400) {
          reject(new GitHubHttpError(res.statusCode, body));
          return;
        }
        resolve(body);
      });
    });
    req.on("error", reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error("GitHub API request timed out"));
    });
    req.end();
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof GitHubHttpError) {
    return error.statusCode >= 500;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timed out") ||
      message.includes("network") ||
      message.includes("socket hang up") ||
      message.includes("econnreset") ||
      message.includes("eai_again") ||
      message.includes("enotfound")
    );
  }

  return false;
}

async function httpsGetWithRetry(url: string, token?: string): Promise<string> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await httpsGet(url, token);
    } catch (error) {
      const shouldRetry =
        attempt < RETRY_DELAYS_MS.length && isRetryableError(error);
      if (!shouldRetry) {
        throw error;
      }

      const delayMs = RETRY_DELAYS_MS[attempt];
      log.warn("GitHub request failed, retrying", {
        url,
        attempt: attempt + 1,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
      await wait(delayMs);
    }
  }

  throw new Error("Retry loop exited unexpectedly");
}

@injectable()
export class PluginSyncService extends TypedEventEmitter<PluginSyncEvents> {
  private config: SyncConfig;
  private lastCommitSha: string | null = null;
  private history: SyncHistoryEntry[] = [];
  private currentState: SyncStatus["state"] = "idle";
  private lastError: string | null = null;
  private lastSyncAt: number | null = null;
  private filesChangedLast = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(
    @inject(MAIN_TOKENS.StoragePaths)
    private readonly storagePaths: IStoragePaths,
  ) {
    super();
    this.config = syncConfigSchema.parse({
      repo: process.env.CITADEL_SYNC_REPO,
      branch: process.env.CITADEL_SYNC_BRANCH,
      intervalMs: process.env.CITADEL_SYNC_INTERVAL_MS
        ? Number(process.env.CITADEL_SYNC_INTERVAL_MS)
        : undefined,
      paths: process.env.CITADEL_SYNC_PATHS
        ? process.env.CITADEL_SYNC_PATHS.split(",")
        : undefined,
    });
  }

  @postConstruct()
  init(): void {
    this.loadState();
    if (this.config.enabled) {
      this.startSync();
    }
  }

  @preDestroy()
  destroy(): void {
    this.stopSync();
  }

  startSync(): void {
    if (this.intervalId) return;
    log.info("Starting plugin sync", { repo: this.config.repo, branch: this.config.branch });
    void this.runSync();
    this.intervalId = setInterval(() => {
      void this.runSync();
    }, this.config.intervalMs);
    this.config = { ...this.config, enabled: true };
    this.emitStatus();
  }

  stopSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config = { ...this.config, enabled: false };
    this.emitStatus();
  }

  async syncNow(): Promise<{ started: boolean }> {
    if (this.isSyncing) {
      return { started: false };
    }
    void this.runSync();
    return { started: true };
  }

  getStatus(): SyncStatus {
    return {
      state: this.currentState,
      lastSyncAt: this.lastSyncAt,
      lastCommitSha: this.lastCommitSha,
      filesChanged: this.filesChangedLast,
      lastError: this.lastError,
      enabled: this.config.enabled,
    };
  }

  getHistory(): SyncHistoryEntry[] {
    return [...this.history];
  }

  updateConfig(input: UpdateConfigInput): void {
    const wasEnabled = this.config.enabled;
    this.config = syncConfigSchema.parse({ ...this.config, ...input });

    if (this.config.enabled !== wasEnabled) {
      if (this.config.enabled) {
        this.startSync();
      } else {
        this.stopSync();
      }
    } else if (this.intervalId && input.intervalMs !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        void this.runSync();
      }, this.config.intervalMs);
    }

    this.saveState();
    this.emitStatus();
  }

  private get syncDir(): string {
    return path.join(this.storagePaths.appDataPath, "plugins", "citadel-sync");
  }

  private get stateFilePath(): string {
    return path.join(this.storagePaths.appDataPath, "plugin-sync", "state.json");
  }

  private get token(): string | undefined {
    return process.env.GITHUB_TOKEN || undefined;
  }

  private loadState(): void {
    try {
      const content = fs.readFileSync(this.stateFilePath, "utf-8");
      const saved = JSON.parse(content) as PersistedSyncState;
      this.lastCommitSha = saved.lastCommitSha ?? null;
      if (saved.config) {
        this.config = syncConfigSchema.parse({ ...this.config, ...saved.config });
      }
    } catch {
      // no prior state
    }
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.stateFilePath);
      fs.mkdirSync(dir, { recursive: true });
      const state: PersistedSyncState = {
        lastCommitSha: this.lastCommitSha,
        config: this.config,
      };
      fs.writeFileSync(this.stateFilePath + ".tmp", JSON.stringify(state, null, 2), "utf-8");
      fs.renameSync(this.stateFilePath + ".tmp", this.stateFilePath);
    } catch (err) {
      log.warn("Failed to save sync state", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async runSync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.currentState = "syncing";
    this.emitStatus();

    const start = Date.now();
    let filesChanged = 0;
    let commitSha: string | null = null;

    try {
      const [owner, repo] = this.config.repo.split("/");
      if (!owner || !repo) throw new Error(`Invalid repo: ${this.config.repo}`);

      commitSha = await this.fetchLatestCommitSha(owner, repo);

      if (commitSha === this.lastCommitSha) {
        this.currentState = "synced";
        this.lastError = null;
        this.isSyncing = false;
        this.emitStatus();
        return;
      }

      log.info("New commit detected", { sha: commitSha, prev: this.lastCommitSha });

      const changedPaths = await this.syncFiles(owner, repo, commitSha);
      filesChanged = changedPaths.length;

      this.lastCommitSha = commitSha;
      this.lastSyncAt = Date.now();
      this.lastError = null;
      this.filesChangedLast = filesChanged;
      this.currentState = "synced";

      this.saveState();
      await this.registerSyncedPlugin();

      if (filesChanged > 0) {
        this.emit(PluginSyncEvent.FilesUpdated, { paths: changedPaths, commitSha });
      }

      this.addHistory({
        at: start,
        commitSha,
        filesChanged,
        durationMs: Date.now() - start,
        status: "success",
        error: null,
      });

      log.info("Plugin sync complete", { filesChanged, commitSha });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("Plugin sync failed", { error: msg });
      this.lastError = msg;
      this.currentState = "error";

      this.addHistory({
        at: start,
        commitSha,
        filesChanged,
        durationMs: Date.now() - start,
        status: "error",
        error: msg,
      });
    } finally {
      this.isSyncing = false;
      this.emitStatus();
    }
  }

  private async fetchLatestCommitSha(owner: string, repo: string): Promise<string> {
    const pathFilter = this.config.paths[0] ?? "plugins/citadel";
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(pathFilter)}&sha=${encodeURIComponent(this.config.branch)}&per_page=1`;
    const body = await httpsGetWithRetry(url, this.token);
    const commits = JSON.parse(body) as GitHubCommit[];
    if (!commits.length) throw new Error("No commits found for path");
    return commits[0].sha;
  }

  private async syncFiles(owner: string, repo: string, sha: string): Promise<string[]> {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
    const body = await httpsGetWithRetry(treeUrl, this.token);
    const tree = JSON.parse(body) as GitHubTree;

    const targetPaths = this.config.paths;
    const blobs = tree.tree.filter(
      (item) =>
        item.type === "blob" &&
        targetPaths.some((p) => item.path.startsWith(p + "/") || item.path === p),
    );

    if (blobs.length === 0) return [];

    fs.mkdirSync(this.syncDir, { recursive: true });

    const written: string[] = [];
    await Promise.all(
      blobs.map(async (item) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${item.path}`;
        try {
          const content = await httpsGetWithRetry(rawUrl, this.token);
          const localPath = path.join(this.syncDir, item.path);
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          const tmpPath = localPath + ".tmp";
          fs.writeFileSync(tmpPath, content, "utf-8");
          fs.renameSync(tmpPath, localPath);
          written.push(item.path);
        } catch (err) {
          log.warn("Failed to download file", { path: item.path, error: err instanceof Error ? err.message : String(err) });
        }
      }),
    );

    return written;
  }

  private async registerSyncedPlugin(): Promise<void> {
    const installedPath = path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");
    const pluginPath = path.join(this.syncDir, this.config.paths[0] ?? "plugins/citadel");

    if (!fs.existsSync(pluginPath)) return;

    let data: InstalledPluginsFile = { version: 1, plugins: {} };
    try {
      const content = fs.readFileSync(installedPath, "utf-8");
      data = JSON.parse(content) as InstalledPluginsFile;
    } catch {
      // file doesn't exist yet — start fresh
    }

    data.plugins["citadel-sync"] = [
      { scope: "citadel-sync", installPath: pluginPath, version: "1.0.0" },
    ];

    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.writeFileSync(installedPath + ".tmp", JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(installedPath + ".tmp", installedPath);
  }

  private addHistory(entry: SyncHistoryEntry): void {
    this.history.unshift(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }
  }

  private emitStatus(): void {
    this.emit(PluginSyncEvent.Status, this.getStatus());
  }
}

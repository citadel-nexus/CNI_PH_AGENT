import { injectable } from "inversify";
import { logger } from "../../utils/logger";
import type {
  Execution,
  GetRecentExecutionsOutput,
  GetWorkflowsOutput,
  Workflow,
} from "./schemas";

const log = logger.scope("n8n-integration");

@injectable()
export class N8nIntegrationService {
  private get apiUrl(): string {
    return process.env.N8N_API_URL ?? "http://localhost:5678";
  }

  private get apiKey(): string {
    return process.env.N8N_API_KEY ?? "";
  }

  async getWorkflows(): Promise<GetWorkflowsOutput> {
    if (!this.apiKey) {
      log.info("N8N_API_KEY not set, returning empty workflows");
      return { workflows: [], total: 0 };
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/workflows`, {
        headers: {
          "X-N8N-API-KEY": this.apiKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        log.warn("n8n workflows request failed", { status: response.status });
        return { workflows: [], total: 0 };
      }

      const data = (await response.json()) as {
        data?: unknown[];
        count?: number;
      };
      const raw = Array.isArray(data.data) ? data.data : [];
      const workflows: Workflow[] = raw.map((w) => this.mapWorkflow(w));
      return { workflows, total: data.count ?? workflows.length };
    } catch (err) {
      log.warn("Failed to fetch n8n workflows", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { workflows: [], total: 0 };
    }
  }

  async getRecentExecutions(limit = 20): Promise<GetRecentExecutionsOutput> {
    if (!this.apiKey) {
      return { executions: [], total: 0 };
    }

    try {
      const url = new URL(`${this.apiUrl}/api/v1/executions`);
      url.searchParams.set("limit", String(limit));

      const response = await fetch(url.toString(), {
        headers: {
          "X-N8N-API-KEY": this.apiKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        log.warn("n8n executions request failed", { status: response.status });
        return { executions: [], total: 0 };
      }

      const data = (await response.json()) as {
        data?: unknown[];
        count?: number;
      };
      const raw = Array.isArray(data.data) ? data.data : [];
      const executions: Execution[] = raw.map((e) => this.mapExecution(e));
      return { executions, total: data.count ?? executions.length };
    } catch (err) {
      log.warn("Failed to fetch n8n executions", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { executions: [], total: 0 };
    }
  }

  private mapWorkflow(raw: unknown): Workflow {
    const w = raw as Record<string, unknown>;
    return {
      id: String(w.id ?? ""),
      name: String(w.name ?? ""),
      active: Boolean(w.active),
      updatedAt: String(w.updatedAt ?? new Date().toISOString()),
      tags: Array.isArray(w.tags)
        ? (w.tags as Array<{ name?: string }>).map((t) => t.name ?? String(t))
        : [],
    };
  }

  private mapExecution(raw: unknown): Execution {
    const e = raw as Record<string, unknown>;
    const rawStatus = String(e.status ?? "");
    const status = (
      ["success", "error", "running", "waiting", "canceled"].includes(rawStatus)
        ? rawStatus
        : "error"
    ) as Execution["status"];

    return {
      id: String(e.id ?? ""),
      workflowId: String(
        (e.workflowData as Record<string, unknown> | undefined)?.id ??
          e.workflowId ??
          "",
      ),
      workflowName: String(
        (e.workflowData as Record<string, unknown> | undefined)?.name ??
          e.workflowName ??
          "",
      ),
      status,
      startedAt: String(e.startedAt ?? new Date().toISOString()),
      finishedAt: e.stoppedAt ? String(e.stoppedAt) : null,
      mode: String(e.mode ?? ""),
    };
  }
}

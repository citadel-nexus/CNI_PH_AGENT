import { injectable } from "inversify";
import { logger } from "../../utils/logger";
import type { N8nExecution, N8nWorkflow } from "./schemas";

const log = logger.scope("n8n-integration-service");

@injectable()
export class N8nIntegrationService {
  private readonly apiUrl = process.env.N8N_API_URL;
  private readonly apiKey = process.env.N8N_API_KEY;

  public async getWorkflows(): Promise<N8nWorkflow[]> {
    if (!this.isConfigured()) {
      log.info("N8N_API_URL or N8N_API_KEY is not configured");
      return [];
    }

    try {
      const body = await this.request<{
        data?: Array<{
          id: string | number;
          name: string;
          active: boolean;
          updatedAt?: string | null;
        }>;
      }>("/api/v1/workflows?limit=50");

      return (body.data ?? []).map((workflow) => ({
        id: String(workflow.id),
        name: workflow.name,
        active: Boolean(workflow.active),
        updatedAt: workflow.updatedAt ?? null,
      }));
    } catch (error) {
      log.warn("Failed to fetch n8n workflows", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getRecentExecutions(): Promise<N8nExecution[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const body = await this.request<{
        data?: Array<{
          id: string | number;
          workflowId?: string | number | null;
          status?: string | null;
          mode?: string | null;
          startedAt?: string | null;
          stoppedAt?: string | null;
        }>;
      }>("/api/v1/executions?limit=25");

      return (body.data ?? []).map((execution) => ({
        id: String(execution.id),
        workflowId:
          execution.workflowId === null || execution.workflowId === undefined
            ? null
            : String(execution.workflowId),
        status: execution.status ?? "unknown",
        mode: execution.mode ?? null,
        startedAt: execution.startedAt ?? null,
        stoppedAt: execution.stoppedAt ?? null,
      }));
    } catch (error) {
      log.warn("Failed to fetch n8n executions", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getErrorCount(): Promise<number> {
    const executions = await this.getRecentExecutions();
    return executions.filter((execution) => execution.status === "error").length;
  }

  private isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey);
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error("N8N_API_URL or N8N_API_KEY is not configured");
    }

    const baseUrl = this.apiUrl.endsWith("/")
      ? this.apiUrl.slice(0, -1)
      : this.apiUrl;

    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": this.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`n8n API request failed: ${response.status} ${text}`);
    }

    return (await response.json()) as T;
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
      const workflows: Workflow[] = raw.map((workflow) =>
        this.mapWorkflow(workflow),
      );

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
      const executions: Execution[] = raw.map((execution) =>
        this.mapExecution(execution),
      );

      return { executions, total: data.count ?? executions.length };
    } catch (err) {
      log.warn("Failed to fetch n8n executions", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { executions: [], total: 0 };
    }
  }

  async getErrorCount(): Promise<number> {
    const { executions } = await this.getRecentExecutions();
    return executions.filter((execution) => execution.status === "error").length;
  }

  private mapWorkflow(raw: unknown): Workflow {
    const workflow = raw as Record<string, unknown>;
    return {
      id: String(workflow.id ?? ""),
      name: String(workflow.name ?? ""),
      active: Boolean(workflow.active),
      updatedAt: String(workflow.updatedAt ?? new Date().toISOString()),
      tags: Array.isArray(workflow.tags)
        ? (workflow.tags as Array<{ name?: string }>).map(
            (tag) => tag.name ?? String(tag),
          )
        : [],
    };
  }

  private mapExecution(raw: unknown): Execution {
    const execution = raw as Record<string, unknown>;
    const rawStatus = String(execution.status ?? "");
    const status = (
      ["success", "error", "running", "waiting", "canceled"].includes(rawStatus)
        ? rawStatus
        : "error"
    ) as Execution["status"];

    return {
      id: String(execution.id ?? ""),
      workflowId: String(
        (execution.workflowData as Record<string, unknown> | undefined)?.id ??
          execution.workflowId ??
          "",
      ),
      workflowName: String(
        (execution.workflowData as Record<string, unknown> | undefined)?.name ??
          execution.workflowName ??
          "",
      ),
      status,
      startedAt: String(execution.startedAt ?? new Date().toISOString()),
      finishedAt: execution.stoppedAt ? String(execution.stoppedAt) : null,
      mode: String(execution.mode ?? ""),
    };
  }
}
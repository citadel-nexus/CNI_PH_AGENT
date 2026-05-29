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
  }
}
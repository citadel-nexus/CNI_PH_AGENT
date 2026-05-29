import type { IUrlLauncher } from "@posthog/platform/url-launcher";
import { getCloudUrlFromRegion } from "@shared/utils/urls";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import type {
  CloudRegion,
  LinearIssue,
  LinearProjectStatus,
  LinearRecentUpdate,
  StartLinearFlowOutput,
} from "./schemas";

const log = logger.scope("linear-integration-service");

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

@injectable()
export class LinearIntegrationService {
  private readonly apiKey = process.env.LINEAR_API_KEY;

  constructor(
    @inject(MAIN_TOKENS.UrlLauncher)
    private readonly urlLauncher: IUrlLauncher,
  ) {}

  public async startFlow(
    region: CloudRegion,
    projectId: number,
  ): Promise<StartLinearFlowOutput> {
    try {
      const cloudUrl = getCloudUrlFromRegion(region);
      const next = `${cloudUrl}/project/${projectId}`;
      const authorizeUrl = `${cloudUrl}/api/environments/${projectId}/integrations/authorize/?kind=linear&next=${encodeURIComponent(next)}`;
      await this.urlLauncher.launch(authorizeUrl);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async getActiveIssues(): Promise<LinearIssue[]> {
    if (!this.apiKey) {
      log.info("LINEAR_API_KEY not set, returning empty issues");
      return [];
    }

    try {
      const data = await this.runQuery<{
        issues?: {
          nodes?: Array<{
            id: string;
            identifier: string;
            title: string;
            priority: number | null;
            updatedAt: string | null;
            url: string | null;
            state?: { name?: string | null } | null;
            assignee?: { name?: string | null } | null;
          }>;
        };
      }>(`
        query ActiveIssues {
          issues(first: 25, filter: { state: { type: { neq: "completed" } } }) {
            nodes {
              id
              identifier
              title
              priority
              updatedAt
              url
              state {
                name
              }
              assignee {
                name
              }
            }
          }
        }
      `);

      return (data.issues?.nodes ?? []).map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        priority: issue.priority ?? null,
        state: issue.state?.name ?? null,
        assignee: issue.assignee?.name ?? null,
        updatedAt: issue.updatedAt ?? null,
        url: issue.url ?? null,
      }));
    } catch (error) {
      log.warn("Failed to fetch Linear issues", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getProjectStatus(): Promise<LinearProjectStatus[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const data = await this.runQuery<{
        projects?: {
          nodes?: Array<{
            id: string;
            name: string;
            progress: number | null;
            updatedAt: string | null;
            url: string | null;
            state?: string | null;
            lead?: { name?: string | null } | null;
          }>;
        };
      }>(`
        query ProjectStatus {
          projects(first: 20) {
            nodes {
              id
              name
              state
              progress
              updatedAt
              url
              lead {
                name
              }
            }
          }
        }
      `);

      return (data.projects?.nodes ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        state: project.state ?? null,
        progress: project.progress ?? null,
        updatedAt: project.updatedAt ?? null,
        lead: project.lead?.name ?? null,
        url: project.url ?? null,
      }));
    } catch (error) {
      log.warn("Failed to fetch Linear project status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getRecentUpdates(): Promise<LinearRecentUpdate[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const data = await this.runQuery<{
        issues?: {
          nodes?: Array<{
            id: string;
            identifier: string;
            title: string;
            updatedAt: string | null;
            url: string | null;
            state?: { name?: string | null } | null;
          }>;
        };
      }>(`
        query RecentIssueUpdates {
          issues(first: 15, orderBy: updatedAt) {
            nodes {
              id
              identifier
              title
              updatedAt
              url
              state {
                name
              }
            }
          }
        }
      `);

      return (data.issues?.nodes ?? []).map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: issue.state?.name ?? null,
        updatedAt: issue.updatedAt ?? null,
        url: issue.url ?? null,
      }));
    } catch (error) {
      log.warn("Failed to fetch Linear updates", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async runQuery<T>(query: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error("LINEAR_API_KEY is not configured");
    }

    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear API request failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };

    if (body.errors?.length) {
      const message = body.errors
        .map((error) => error.message)
        .filter(Boolean)
        .join("; ");
      throw new Error(message || "Linear API returned GraphQL errors");
    }

    if (!body.data) {
      throw new Error("Linear API response missing data");
    }

    return body.data;
  }
}
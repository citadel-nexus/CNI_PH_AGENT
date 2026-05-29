import type { IUrlLauncher } from "@posthog/platform/url-launcher";
import { getCloudUrlFromRegion } from "@shared/utils/urls.js";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens.js";
import { logger } from "../../utils/logger.js";
import type {
  CloudRegion,
  LinearIssue,
  LinearProjectStatus,
  LinearRecentUpdate,
  StartLinearFlowOutput,
} from "./schemas.js";

const log = logger.scope("linear-integration-service");

@injectable()
export class LinearIntegrationService {
  private readonly apiKey = process.env.LINEAR_API_KEY;
  private static readonly API_URL = "https://api.linear.app/graphql";

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

      log.info("Opening Linear authorization URL in browser");
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
    }>(
      `
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
      `,
    );

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
  }

  public async getProjectStatus(): Promise<LinearProjectStatus[]> {
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
    }>(
      `
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
      `,
    );

    return (data.projects?.nodes ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      state: project.state ?? null,
      progress: project.progress ?? null,
      updatedAt: project.updatedAt ?? null,
      lead: project.lead?.name ?? null,
      url: project.url ?? null,
    }));
  }

  public async getRecentUpdates(): Promise<LinearRecentUpdate[]> {
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
    }>(
      `
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
      `,
    );

    return (data.issues?.nodes ?? []).map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      state: issue.state?.name ?? null,
      updatedAt: issue.updatedAt ?? null,
      url: issue.url ?? null,
    }));
  }

  private async runQuery<T>(query: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error("LINEAR_API_KEY is not configured");
    }

    const response = await fetch(LinearIntegrationService.API_URL, {
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
      const message = body.errors.map((error) => error.message).join("; ");
      throw new Error(message || "Linear API returned GraphQL errors");
    }

    if (!body.data) {
      throw new Error("Linear API response missing data");
    }

    return body.data;
  }
}

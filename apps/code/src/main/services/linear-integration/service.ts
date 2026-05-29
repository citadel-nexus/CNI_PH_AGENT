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
  GetActiveIssuesOutput,
  GetProjectStatusOutput,
  LinearIssue,
  StartLinearFlowOutput,
} from "./schemas.js";

const log = logger.scope("linear-integration-service");

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

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
  public async getActiveIssues(): Promise<GetActiveIssuesOutput> {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      log.info("LINEAR_API_KEY not set, returning empty issues");
      return { issues: [], total: 0 };
    }

    const query = `
      query ActiveIssues {
        issues(
          filter: { state: { type: { nin: ["completed", "cancelled"] } } }
          orderBy: updatedAt
          first: 50
        ) {
          nodes {
            id
            title
            state { name }
            priority
            assignee { displayName }
            url
            updatedAt
          }
          totalCount
        }
      }
    `;

    try {
      const result = await this.graphql<{
        issues: {
          nodes: Array<{
            id: string;
            title: string;
            state: { name: string };
            priority: number;
            assignee: { displayName: string } | null;
            url: string;
            updatedAt: string;
          }>;
          totalCount: number;
        };
      }>(apiKey, query);

      const issues: LinearIssue[] = result.issues.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        state: n.state.name,
        priority: n.priority,
        assignee: n.assignee?.displayName ?? null,
        url: n.url,
        updatedAt: n.updatedAt,
      }));

      return { issues, total: result.issues.totalCount };
    } catch (err) {
      log.warn("Failed to fetch Linear issues", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { issues: [], total: 0 };
    }
  }

  public async getProjectStatus(): Promise<GetProjectStatusOutput> {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      return {
        teamId: "",
        teamName: "",
        activeCycle: null,
        openIssueCount: 0,
        inProgressCount: 0,
        completedTodayCount: 0,
      };
    }

    const query = `
      query ProjectStatus {
        teams(first: 1) {
          nodes {
            id
            name
            activeCycle {
              id
              name
              startsAt
              endsAt
              completedAt
              completedIssueCountHistory
              issueCountHistory
            }
            issues(
              filter: { state: { type: { eq: "started" } } }
              first: 1
            ) { totalCount }
          }
        }
        issues(
          filter: { state: { type: { nin: ["completed", "cancelled"] } } }
          first: 1
        ) { totalCount }
      }
    `;

    try {
      const result = await this.graphql<{
        teams: {
          nodes: Array<{
            id: string;
            name: string;
            activeCycle: {
              id: string;
              name: string | null;
              startsAt: string;
              endsAt: string;
              completedAt: string | null;
              completedIssueCountHistory: number[];
              issueCountHistory: number[];
            } | null;
            issues: { totalCount: number };
          }>;
        };
        issues: { totalCount: number };
      }>(apiKey, query);

      const team = result.teams.nodes[0];
      if (!team) {
        return {
          teamId: "",
          teamName: "",
          activeCycle: null,
          openIssueCount: result.issues.totalCount,
          inProgressCount: 0,
          completedTodayCount: 0,
        };
      }

      const rawCycle = team.activeCycle;
      const activeCycle = rawCycle
        ? {
            id: rawCycle.id,
            name: rawCycle.name,
            startsAt: rawCycle.startsAt,
            endsAt: rawCycle.endsAt,
            completedAt: rawCycle.completedAt,
            completedIssueCount:
              rawCycle.completedIssueCountHistory.at(-1) ?? 0,
            issueCount: rawCycle.issueCountHistory.at(-1) ?? 0,
            percentComplete:
              rawCycle.issueCountHistory.at(-1)
                ? Math.round(
                    ((rawCycle.completedIssueCountHistory.at(-1) ?? 0) /
                      (rawCycle.issueCountHistory.at(-1) ?? 1)) *
                      100,
                  )
                : 0,
          }
        : null;

      return {
        teamId: team.id,
        teamName: team.name,
        activeCycle,
        openIssueCount: result.issues.totalCount,
        inProgressCount: team.issues.totalCount,
        completedTodayCount: 0,
      };
    } catch (err) {
      log.warn("Failed to fetch Linear project status", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        teamId: "",
        teamName: "",
        activeCycle: null,
        openIssueCount: 0,
        inProgressCount: 0,
        completedTodayCount: 0,
      };
    }
  }

  private async graphql<T>(apiKey: string, query: string): Promise<T> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
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
      throw new Error(`Linear API error: ${response.status}`);
    }

    const json = (await response.json()) as { data?: T; errors?: unknown[] };
    if (json.errors?.length) {
      throw new Error(`Linear GraphQL error: ${JSON.stringify(json.errors)}`);
    }
    if (!json.data) {
      throw new Error("Linear API returned no data");
    }
    return json.data;
  }
}


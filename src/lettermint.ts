import { LettermintClient, type LettermintClientConfig } from './client';
import {
  DomainsEndpoint,
  MessagesEndpoint,
  ProjectsEndpoint,
  RoutesEndpoint,
  StatsEndpoint,
  SuppressionsEndpoint,
  TeamEndpoint,
  WebhooksEndpoint,
} from './endpoints/api';
import { EmailEndpoint } from './endpoints/email';
import type * as Types from './types';

/**
 * Lettermint SDK
 */
export class Lettermint {
  /**
   * The Lettermint client
   */
  private readonly client: LettermintClient;

  /**
   * Email endpoint for sending emails
   */
  public readonly email: EmailEndpoint;

  /**
   * Create a new Lettermint SDK instance
   *
   * @param config Configuration options
   */
  constructor(config: LettermintClientConfig) {
    this.client = new LettermintClient(config);
    this.email = new EmailEndpoint(this.client);
  }

  public static email(
    apiToken: string,
    config?: Omit<LettermintClientConfig, 'apiToken' | 'authMode'>
  ): EmailEndpoint {
    return new EmailEndpoint(new LettermintClient({ ...config, apiToken }));
  }

  public static api(
    apiToken: string,
    config?: Omit<LettermintClientConfig, 'apiToken' | 'authMode'>
  ): ApiClient {
    return new ApiClient(apiToken, config);
  }
}

export class ApiClient {
  private readonly client: LettermintClient;

  public readonly domains: DomainsEndpoint;
  public readonly messages: MessagesEndpoint;
  public readonly projects: ProjectsEndpoint;
  public readonly routes: RoutesEndpoint;
  public readonly stats: StatsEndpoint;
  public readonly suppressions: SuppressionsEndpoint;
  public readonly team: TeamEndpoint;
  public readonly webhooks: WebhooksEndpoint;

  public constructor(
    apiToken: string,
    config?: Omit<LettermintClientConfig, 'apiToken' | 'authMode'>
  ) {
    this.client = new LettermintClient({ ...config, apiToken, authMode: 'api' });
    this.domains = new DomainsEndpoint(this.client);
    this.messages = new MessagesEndpoint(this.client);
    this.projects = new ProjectsEndpoint(this.client);
    this.routes = new RoutesEndpoint(this.client);
    this.stats = new StatsEndpoint(this.client);
    this.suppressions = new SuppressionsEndpoint(this.client);
    this.team = new TeamEndpoint(this.client);
    this.webhooks = new WebhooksEndpoint(this.client);
  }

  public async ping(): Promise<string> {
    return (await this.client.getRaw('/ping')).trim();
  }

  public async blockedFileTypes(): Promise<Types.BlockedFileTypesResponse> {
    return this.client.get('/blocked-file-types');
  }
}

export default Lettermint;

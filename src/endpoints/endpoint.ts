import type { LettermintClient } from '../client';

/**
 * Base class for all API endpoints
 */
export abstract class Endpoint {
  /**
   * The HTTP client used to make API requests
   */
  protected readonly httpClient: LettermintClient;

  /**
   * Create a new endpoint instance
   *
   * @param client The Lettermint client
   */
  constructor(client: LettermintClient) {
    this.httpClient = client;
  }
}

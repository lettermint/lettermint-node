import { LettermintClient, type LettermintClientConfig } from './client';
import { EmailEndpoint } from './endpoints/email';

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
}

export default Lettermint;

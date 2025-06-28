import { Endpoint } from './endpoint';

/**
 * Interface for email attachment
 */
export interface EmailAttachment {
  /**
   * The filename of the attachment
   */
  filename: string;

  /**
   * The base64-encoded content of the attachment
   */
  content: string;
}

/**
 * Interface for the email payload
 */
export interface EmailPayload {
  /**
   * The sender's email address
   */
  from: string;

  /**
   * The recipient email addresses
   */
  to: string[];

  /**
   * The email subject
   */
  subject: string;

  /**
   * The HTML content of the email (optional)
   *
   * At least one of `text` or `html` is required.
   */
  html?: string;

  /**
   * The plain text content of the email (optional)
   *
   * At least one of `text` or `html` is required.
   */
  text?: string;

  /**
   * The CC email addresses (optional)
   */
  cc?: string[];

  /**
   * The BCC email addresses (optional)
   */
  bcc?: string[];

  /**
   * The Reply-To email addresses (optional)
   */
  reply_to?: string[];

  /**
   * Custom headers for the email (optional)
   */
  headers?: Record<string, string>;

  /**
   * Email attachments (optional)
   */
  attachments?: EmailAttachment[];

  /**
   * The route identifier (optional)
   */
  route?: string;
}

/**
 * Response from the send email API
 */
export interface SendEmailResponse {
  /**
   * The unique message ID
   */
  message_id: string;

  /**
   * The status of the message
   */
  status:
    | 'pending'
    | 'queued'
    | 'processed'
    | 'delivered'
    | 'soft_bounced'
    | 'hard_bounced'
    | 'failed';
}

/**
 * Endpoint for sending emails
 */
export class EmailEndpoint extends Endpoint {
  /**
   * The email payload to be sent
   */
  private payload: EmailPayload = {
    from: '',
    to: [],
    subject: '',
  };

  /**
   * The idempotency key for the request
   */
  private idempotencyKeyValue?: string;

  /**
   * Set custom headers for the email
   *
   * @example headers({ 'X-Custom': 'Value' })
   *
   * @param headers The custom headers
   * @returns The current instance for chaining
   */
  public headers(headers: Record<string, string>): this {
    this.payload.headers = headers;
    return this;
  }

  /**
   * Set the idempotency key for the request
   * 
   * This helps prevent duplicate email sends when retrying failed requests.
   * If you provide the same idempotency key for multiple requests, only the first one will be processed.
   * 
   * @example idempotencyKey('unique-id-123')
   * 
   * @param key A unique string to identify this request
   * @returns The current instance for chaining
   */
  public idempotencyKey(key: string): this {
    this.idempotencyKeyValue = key;
    return this;
  }

  /**
   * Set the sender email address
   *
   * Supports RFC 5322 addresses, e.g. <EMAIL>, <NAME> <<EMAIL>>.
   *
   * @example from('John Doe <john@example.com>')
   * @example from('john@example.com')
   *
   * @param email The sender's email address
   * @returns The current instance for chaining
   */
  public from(email: string): this {
    this.payload.from = email;
    return this;
  }

  /**
   * Set one or more recipient email addresses
   *
   * @example to('user1@example.com', 'user2@example.com')
   *
   * @param emails One or more recipient email addresses
   * @returns The current instance for chaining
   */
  public to(...emails: string[]): this {
    this.payload.to = emails;
    return this;
  }

  /**
   * Set the subject of the email
   *
   * @param subject The subject line
   * @returns The current instance for chaining
   */
  public subject(subject: string): this {
    this.payload.subject = subject;
    return this;
  }

  /**
   * Set the HTML body of the email
   *
   * @param html The HTML content for the email body
   * @returns The current instance for chaining
   */
  public html(html: string | null): this {
    if (html !== null) {
      this.payload.html = html;
    }
    return this;
  }

  /**
   * Set the plain text body of the email
   *
   * @param text The plain text content for the email body
   * @returns The current instance for chaining
   */
  public text(text: string | null): this {
    if (text !== null) {
      this.payload.text = text;
    }
    return this;
  }

  /**
   * Set one or more CC email addresses
   *
   * @example cc('cc1@example.com', 'cc2@example.com')
   *
   * @param emails Email addresses to be CC'd
   * @returns The current instance for chaining
   */
  public cc(...emails: string[]): this {
    this.payload.cc = emails;
    return this;
  }

  /**
   * Set one or more BCC email addresses
   *
   * @example bcc('bcc1@example.com', 'bcc2@example.com')
   *
   * @param emails Email addresses to be BCC'd
   * @returns The current instance for chaining
   */
  public bcc(...emails: string[]): this {
    this.payload.bcc = emails;
    return this;
  }

  /**
   * Set one or more Reply-To email addresses
   *
   * @example replyTo('reply1@example.com', 'reply2@example.com')
   *
   * @param emails Reply-To email addresses
   * @returns The current instance for chaining
   */
  public replyTo(...emails: string[]): this {
    this.payload.reply_to = emails;
    return this;
  }

  /**
   * Set the routing key for the email
   *
   * @param route The routing key
   * @returns The current instance for chaining
   */
  public route(route: string): this {
    this.payload.route = route;
    return this;
  }

  /**
   * Attach a file to the email
   *
   * @param filename The attachment filename
   * @param content The base64-encoded file content
   * @returns The current instance for chaining
   */
  public attach(filename: string, content: string): this {
    if (!this.payload.attachments) {
      this.payload.attachments = [];
    }

    this.payload.attachments.push({
      filename,
      content,
    });

    return this;
  }

  /**
   * Send the composed email using the current payload
   *
   * @returns Promise resolving to the API response
   * @throws Error on HTTP or API failure
   */
  public async send(): Promise<SendEmailResponse> {
    const config = this.idempotencyKeyValue
      ? { headers: { 'Idempotency-Key': this.idempotencyKeyValue } }
      : undefined;

    return this.httpClient.post<SendEmailResponse>('/send', this.payload, config);
  }
}

import { type BinaryInput, bytesToBase64, isBinary, toBytes } from './encoding';
import { LettermintValidationError } from './errors';
import type {
  MessageAttachmentInput,
  MessageTagInput,
  SandboxResult,
  SendBatchMailResponse,
  SendMailRequest,
  SendMailRequestSettings,
  SendMailResponse,
} from './generated/types';
import { inspectCustom, renderInspect } from './redact';
import type { IdempotentRequestOptions, RequestOptions, Transport } from './transport';

/** An attachment in an {@link EmailMessage}. `content` may be base64 text or raw bytes. */
export interface EmailMessageAttachment extends Omit<MessageAttachmentInput, 'content'> {
  content: string | BinaryInput;
}

/**
 * An email, in the API's wire format (`reply_to`, `scheduled_at`, ...).
 * Attachment content may also be raw bytes; the SDK base64-encodes it.
 */
export interface EmailMessage extends Omit<SendMailRequest, 'attachments'> {
  attachments?: EmailMessageAttachment[];
}

/** An attachment for {@link EmailBuilder.attach}. */
export interface EmailAttachment {
  filename: string;
  /** Base64-encoded text, or raw bytes (`Uint8Array`, `ArrayBuffer`). */
  content: string | BinaryInput;
  /** MIME type, for example `application/pdf`. Detected by the API when omitted. */
  contentType?: string;
  /** Content-ID for inline images referenced as `cid:<contentId>` in the HTML. */
  contentId?: string;
}

/** Options of `send()` and `sendBatch()`. */
export type SendOptions = IdempotentRequestOptions;

const TAG_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const TAG_VALUE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TAGS = 20;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(field: string, message: string): never {
  throw new LettermintValidationError(message, field);
}

function validateTags(tags: unknown, hasLegacyTag: boolean, field: string): void {
  if (tags === undefined) return;
  if (!Array.isArray(tags))
    fail(field, 'Message tags must be an array of { name, value } objects.');
  const maximum = hasLegacyTag ? MAX_TAGS - 1 : MAX_TAGS;
  if (tags.length > maximum) {
    fail(
      field,
      hasLegacyTag
        ? `A legacy tag and no more than ${maximum} message tags are permitted.`
        : `No more than ${maximum} message tags are permitted.`
    );
  }
  const names = new Set<string>();
  for (const tag of tags as unknown[]) {
    if (!isPlainObject(tag) || typeof tag.name !== 'string' || typeof tag.value !== 'string') {
      fail(field, 'Message tags must be { name, value } objects with string values.');
    }
    const { name, value } = tag as unknown as MessageTagInput;
    if (!TAG_NAME.test(name)) fail(field, 'Message tag names must match ^[A-Za-z0-9_-]{1,32}$.');
    if (name.toLowerCase().startsWith('__lettermint')) {
      fail(field, 'Message tag names must not start with __lettermint.');
    }
    if (!TAG_VALUE.test(value)) fail(field, 'Message tag values must match ^[A-Za-z0-9_-]{1,64}$.');
    if (names.has(name)) fail(field, 'Message tag names must be unique (case-sensitive).');
    names.add(name);
  }
}

/**
 * Checks what the SDK can check before a request: the message shape, tags and
 * attachments. Shared by `emails.send()`, `emails.sendBatch()` and the builder.
 */
export function validateEmailMessage(
  message: unknown,
  prefix = ''
): asserts message is EmailMessage {
  const at = (field: string) => (prefix ? `${prefix}.${field}` : field);
  if (!isPlainObject(message)) fail(prefix || 'message', 'An email message must be an object.');
  const legacyTag = message.tag;
  if (legacyTag !== undefined && legacyTag !== null && typeof legacyTag !== 'string') {
    fail(at('tag'), 'The legacy tag must be a string.');
  }
  validateTags(message.tags, typeof legacyTag === 'string' && legacyTag !== '', at('tags'));
  const attachments = message.attachments;
  if (attachments !== undefined) {
    if (!Array.isArray(attachments)) fail(at('attachments'), 'Attachments must be an array.');
    attachments.forEach((attachment: unknown, index: number) => {
      const field = `${at('attachments')}[${index}]`;
      if (
        !isPlainObject(attachment) ||
        typeof attachment.filename !== 'string' ||
        !attachment.filename
      ) {
        fail(field, 'An attachment needs a filename.');
      }
      if (typeof attachment.content !== 'string' && !isBinary(attachment.content)) {
        fail(field, 'Attachment content must be a base64 string, a Uint8Array or an ArrayBuffer.');
      }
    });
  }
}

/** Returns a deep copy of the message in wire format, with binary attachment content base64-encoded. */
function toWire(message: EmailMessage): SendMailRequest {
  const copy = structuredCopy(message) as SendMailRequest;
  if (message.attachments) {
    copy.attachments = message.attachments.map((attachment) => ({
      ...attachment,
      content:
        typeof attachment.content === 'string'
          ? attachment.content
          : bytesToBase64(attachment.content),
    }));
  }
  return copy;
}

/** Copies plain data (objects, arrays, scalars and bytes). */
function structuredCopy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuredCopy);
  if (isBinary(value)) return toBytes(value).slice();
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = structuredCopy(item);
    }
    return result;
  }
  return value;
}

type Sender = (message: EmailMessage, options?: SendOptions) => Promise<SendMailResponse>;

/**
 * An immutable email builder, created by `lettermint.emails.compose()`.
 *
 * Every setter returns a new builder and leaves the current one unchanged, so a
 * base builder can be shared and reused safely, also across concurrent sends.
 * `to`, `cc`, `bcc` and `replyTo` replace their list; `attach` appends.
 */
export class EmailBuilder {
  readonly #message: EmailMessage;
  readonly #send: Sender;

  /** @internal Use `lettermint.emails.compose()`. */
  constructor(send: Sender, message: EmailMessage = { from: '', to: [], subject: '' }) {
    this.#send = send;
    this.#message = message;
  }

  #with(changes: Partial<EmailMessage>): EmailBuilder {
    const message = { ...this.#message, ...changes } as EmailMessage;
    for (const key of Object.keys(changes) as (keyof EmailMessage)[]) {
      if (changes[key] === undefined) delete message[key];
    }
    validateEmailMessage(message);
    return new EmailBuilder(this.#send, message);
  }

  /** Sender, for example `Acme <hello@acme.com>`. */
  from(address: string): EmailBuilder {
    return this.#with({ from: address });
  }

  /** Replaces the recipients. */
  to(...addresses: string[]): EmailBuilder {
    return this.#with({ to: [...addresses] });
  }

  /** Replaces the CC recipients. */
  cc(...addresses: string[]): EmailBuilder {
    return this.#with({ cc: [...addresses] });
  }

  /** Replaces the BCC recipients. */
  bcc(...addresses: string[]): EmailBuilder {
    return this.#with({ bcc: [...addresses] });
  }

  /** Replaces the Reply-To addresses. */
  replyTo(...addresses: string[]): EmailBuilder {
    return this.#with({ reply_to: [...addresses] });
  }

  subject(subject: string): EmailBuilder {
    return this.#with({ subject });
  }

  /** HTML body. `null` removes it. */
  html(html: string | null): EmailBuilder {
    return this.#with({ html: html ?? undefined });
  }

  /** Plain-text body. `null` removes it. */
  text(text: string | null): EmailBuilder {
    return this.#with({ text: text ?? undefined });
  }

  /** Replaces the custom email headers. */
  headers(headers: Record<string, string>): EmailBuilder {
    return this.#with({ headers: { ...headers } });
  }

  /** Replaces the metadata (tracked with the email, not added as headers). */
  metadata(metadata: Record<string, string>): EmailBuilder {
    return this.#with({ metadata: { ...metadata } });
  }

  /** The legacy single tag. `null` removes it. */
  tag(tag: string | null): EmailBuilder {
    return this.#with({ tag: tag ?? undefined });
  }

  /** Replaces the name/value tags (up to 20, or 19 with a legacy `tag`). */
  tags(tags: MessageTagInput[]): EmailBuilder {
    return this.#with({ tags: Array.isArray(tags) ? tags.map((tag) => ({ ...tag })) : tags });
  }

  /** The route slug to send through. */
  route(route: string): EmailBuilder {
    return this.#with({ route });
  }

  /** Schedules delivery. Strings are passed through (ISO 8601 or English); dates are sent as ISO 8601. */
  scheduledAt(when: string | Date | null): EmailBuilder {
    return this.#with({
      scheduled_at: when instanceof Date ? when.toISOString() : (when ?? undefined),
    });
  }

  /** Per-email settings that override the route settings. */
  settings(settings: SendMailRequestSettings): EmailBuilder {
    return this.#with({ settings: { ...settings } });
  }

  /** The result a Sandbox project simulates for every recipient. */
  sandboxResult(result: SandboxResult): EmailBuilder {
    return this.#with({ sandbox_result: result });
  }

  /** Adds an attachment. */
  attach(attachment: EmailAttachment): EmailBuilder {
    if (!isPlainObject(attachment)) {
      fail(
        'attachments',
        'attach() takes an object: { filename, content, contentType?, contentId? }.'
      );
    }
    const { filename, content, contentType, contentId } = attachment;
    const next: EmailMessageAttachment = {
      filename,
      content: isBinary(content) ? toBytes(content).slice() : content,
    };
    if (contentType !== undefined) next.content_type = contentType;
    if (contentId !== undefined) next.content_id = contentId;
    return this.#with({ attachments: [...(this.#message.attachments ?? []), next] });
  }

  /** Returns a copy of the message in the API's wire format, with attachments base64-encoded. */
  build(): SendMailRequest {
    return toWire(this.#message);
  }

  /** Sends a snapshot of this email. The builder stays unchanged and can be sent again. */
  send(options?: SendOptions): Promise<SendMailResponse> {
    return this.#send(this.#message, options);
  }

  /** The message in wire format. Contains no credentials. */
  toJSON(): SendMailRequest {
    return this.build();
  }

  [inspectCustom](_depth: number, options: unknown, inspect: unknown): string {
    return renderInspect('EmailBuilder', this.build(), options, inspect);
  }
}

/**
 * Sends email with the project sending token (`x-lettermint-token`).
 * Holds no message state: every call sends exactly what it is given.
 */
export class Emails {
  readonly #transport: Transport;

  /** @internal */
  constructor(transport: Transport) {
    this.#transport = transport;
  }

  /** Sends one email. */
  async send(message: EmailMessage, options?: SendOptions): Promise<SendMailResponse> {
    this.#transport.assertAuth('emails.send', 'sending');
    validateEmailMessage(message);
    return this.#transport.call('POST /send', {
      label: 'emails.send',
      body: toWire(message),
      idempotencyKey: options?.idempotencyKey,
      options,
    });
  }

  /** Sends up to 500 emails in one request. Accepts messages and builders. */
  async sendBatch(
    messages: (EmailMessage | EmailBuilder)[],
    options?: SendOptions
  ): Promise<SendBatchMailResponse> {
    this.#transport.assertAuth('emails.sendBatch', 'sending');
    if (!Array.isArray(messages)) fail('messages', 'sendBatch() takes an array of messages.');
    const body = messages.map((item, index) => {
      if (item instanceof EmailBuilder) return item.build();
      validateEmailMessage(item, `messages[${index}]`);
      return toWire(item);
    });
    return this.#transport.call('POST /send/batch', {
      label: 'emails.sendBatch',
      body,
      idempotencyKey: options?.idempotencyKey,
      options,
    });
  }

  /**
   * Starts an immutable email builder. Every setter returns a new builder.
   * Pass a message to start from it.
   */
  compose(message?: EmailMessage): EmailBuilder {
    this.#transport.assertAuth('emails.compose', 'sending');
    let initial: EmailMessage | undefined;
    if (message !== undefined) {
      validateEmailMessage(message);
      initial = structuredCopy(message) as EmailMessage;
    }
    return new EmailBuilder((snapshot, options) => this.send(snapshot, options), initial);
  }

  /** Checks the sending token: `GET /ping` returns `pong`. */
  async ping(options?: RequestOptions): Promise<string> {
    const text = await this.#transport.call('GET /ping', {
      label: 'emails.ping',
      auth: 'sending',
      options,
    });
    return text.trim();
  }

  toJSON(): Record<string, never> {
    return {};
  }

  [inspectCustom](_depth: number, options: unknown, inspect: unknown): string {
    return renderInspect('Emails', {}, options, inspect);
  }
}

import type {
  ListMessageEventsQuery,
  ListMessageEventsResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  MessageData,
  MessageEventData,
  MessageListData,
  ProcessInboundMessageResponse,
  RescheduleMessageRequest,
  ScheduledMessage,
} from '../generated/types';
import type { NestedQuery } from '../query';
import type { IdempotentRequestOptions, RequestOptions, Transport } from '../transport';
import { ApiResource } from './base';

/**
 * Sent and received messages. Team token; `reschedule` and `cancel` also
 * accept the sending token when no team token is configured.
 */
export class Messages extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Messages');
  }

  /** Lists messages, one page at a time. */
  list(
    query?: NestedQuery<ListMessagesQuery>,
    options?: RequestOptions
  ): Promise<ListMessagesResponse> {
    return this.request('GET /messages', { label: 'messages.list', query, options });
  }

  /** Iterates over every message, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListMessagesQuery>,
    options?: RequestOptions
  ): AsyncGenerator<MessageListData, void, undefined> {
    return this.paginate('GET /messages', { label: 'messages.iterate', query, options });
  }

  retrieve(messageId: string, options?: RequestOptions): Promise<MessageData> {
    return this.request('GET /messages/{messageId}', {
      label: 'messages.retrieve',
      path: { messageId },
      options,
    });
  }

  /** Lists the events of a message, one page at a time. */
  events(
    messageId: string,
    query?: NestedQuery<ListMessageEventsQuery>,
    options?: RequestOptions
  ): Promise<ListMessageEventsResponse> {
    return this.request('GET /messages/{messageId}/events', {
      label: 'messages.events',
      path: { messageId },
      query,
      options,
    });
  }

  /** Iterates over every event of a message, following `next_cursor`. */
  iterateEvents(
    messageId: string,
    query?: NestedQuery<ListMessageEventsQuery>,
    options?: RequestOptions
  ): AsyncGenerator<MessageEventData, void, undefined> {
    return this.paginate('GET /messages/{messageId}/events', {
      label: 'messages.iterateEvents',
      path: { messageId },
      query,
      options,
    });
  }

  /** The raw RFC 822 source. */
  source(messageId: string, options?: RequestOptions): Promise<string> {
    return this.request('GET /messages/{messageId}/source', {
      label: 'messages.source',
      path: { messageId },
      options,
    });
  }

  /** The HTML body. */
  html(messageId: string, options?: RequestOptions): Promise<string> {
    return this.request('GET /messages/{messageId}/html', {
      label: 'messages.html',
      path: { messageId },
      options,
    });
  }

  /** The plain-text body. */
  text(messageId: string, options?: RequestOptions): Promise<string> {
    return this.request('GET /messages/{messageId}/text', {
      label: 'messages.text',
      path: { messageId },
      options,
    });
  }

  /** Moves a scheduled message to another delivery time. */
  reschedule(
    messageId: string,
    body: RescheduleMessageRequest,
    options?: RequestOptions
  ): Promise<ScheduledMessage> {
    return this.request('PATCH /messages/{messageId}', {
      label: 'messages.reschedule',
      path: { messageId },
      body,
      options,
    });
  }

  /** Cancels a scheduled message. */
  cancel(messageId: string, options?: RequestOptions): Promise<ScheduledMessage> {
    return this.request('POST /messages/{messageId}/cancel', {
      label: 'messages.cancel',
      path: { messageId },
      options,
    });
  }

  /** Releases one quarantined inbound message for webhook delivery. */
  process(
    messageId: string,
    options?: IdempotentRequestOptions
  ): Promise<ProcessInboundMessageResponse> {
    return this.request('POST /messages/{messageId}/process', {
      label: 'messages.process',
      path: { messageId },
      idempotencyKey: options?.idempotencyKey,
      options,
    });
  }
}

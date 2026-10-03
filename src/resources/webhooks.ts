import type {
  ListWebhookDeliveriesQuery,
  ListWebhookDeliveriesResponse,
  ListWebhooksQuery,
  ListWebhooksResponse,
  MessageResponse,
  StoreWebhookData,
  TestWebhookResponse,
  UpdateWebhookData,
  WebhookData,
  WebhookDeliveryData,
  WebhookDeliveryListData,
  WebhookListData,
  WebhookMutationResponse,
  WebhookSecretResponse,
} from '../generated/types';
import type { NestedQuery } from '../query';
import type { RequestOptions, Transport } from '../transport';
import { ApiResource } from './base';

/** Delivery attempts of a webhook. Team token. */
export class WebhookDeliveries extends ApiResource {
  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'WebhookDeliveries');
  }

  /** Lists the deliveries of a webhook, one page at a time. */
  list(
    webhookId: string,
    query?: NestedQuery<ListWebhookDeliveriesQuery>,
    options?: RequestOptions
  ): Promise<ListWebhookDeliveriesResponse> {
    return this.request('GET /webhooks/{webhookId}/deliveries', {
      label: 'webhooks.deliveries.list',
      path: { webhookId },
      query,
      options,
    });
  }

  /** Iterates over every delivery of a webhook, following `next_cursor`. */
  iterate(
    webhookId: string,
    query?: NestedQuery<ListWebhookDeliveriesQuery>,
    options?: RequestOptions
  ): AsyncGenerator<WebhookDeliveryListData, void, undefined> {
    return this.paginate('GET /webhooks/{webhookId}/deliveries', {
      label: 'webhooks.deliveries.iterate',
      path: { webhookId },
      query,
      options,
    });
  }

  retrieve(
    webhookId: string,
    deliveryId: string,
    options?: RequestOptions
  ): Promise<WebhookDeliveryData> {
    return this.request('GET /webhooks/{webhookId}/deliveries/{deliveryId}', {
      label: 'webhooks.deliveries.retrieve',
      path: { webhookId, deliveryId },
      options,
    });
  }
}

/** Webhook endpoints. Team token. To verify incoming deliveries, use `Webhook`. */
export class Webhooks extends ApiResource {
  /** Delivery attempts of a webhook. */
  public readonly deliveries: WebhookDeliveries;

  /** @internal */
  constructor(transport: Transport) {
    super(transport, 'Webhooks');
    this.deliveries = new WebhookDeliveries(transport);
  }

  /** Lists webhooks, one page at a time. */
  list(
    query?: NestedQuery<ListWebhooksQuery>,
    options?: RequestOptions
  ): Promise<ListWebhooksResponse> {
    return this.request('GET /webhooks', { label: 'webhooks.list', query, options });
  }

  /** Iterates over every webhook, following `next_cursor`. */
  iterate(
    query?: NestedQuery<ListWebhooksQuery>,
    options?: RequestOptions
  ): AsyncGenerator<WebhookListData, void, undefined> {
    return this.paginate('GET /webhooks', { label: 'webhooks.iterate', query, options });
  }

  /** Creates a webhook. The response holds its signing secret once. */
  create(body: StoreWebhookData, options?: RequestOptions): Promise<WebhookSecretResponse> {
    return this.request('POST /webhooks', { label: 'webhooks.create', body, options });
  }

  retrieve(webhookId: string, options?: RequestOptions): Promise<WebhookData> {
    return this.request('GET /webhooks/{webhookId}', {
      label: 'webhooks.retrieve',
      path: { webhookId },
      options,
    });
  }

  update(
    webhookId: string,
    body: UpdateWebhookData,
    options?: RequestOptions
  ): Promise<WebhookMutationResponse> {
    return this.request('PUT /webhooks/{webhookId}', {
      label: 'webhooks.update',
      path: { webhookId },
      body,
      options,
    });
  }

  delete(webhookId: string, options?: RequestOptions): Promise<MessageResponse> {
    return this.request('DELETE /webhooks/{webhookId}', {
      label: 'webhooks.delete',
      path: { webhookId },
      options,
    });
  }

  /** Sends a `webhook.test` delivery. */
  test(webhookId: string, options?: RequestOptions): Promise<TestWebhookResponse> {
    return this.request('POST /webhooks/{webhookId}/test', {
      label: 'webhooks.test',
      path: { webhookId },
      options,
    });
  }

  /** Replaces the signing secret. The response holds the new secret once. */
  regenerateSecret(webhookId: string, options?: RequestOptions): Promise<WebhookSecretResponse> {
    return this.request('POST /webhooks/{webhookId}/regenerate-secret', {
      label: 'webhooks.regenerateSecret',
      path: { webhookId },
      options,
    });
  }
}

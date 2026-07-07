import { LettermintClient } from './client';
import { Lettermint } from './lettermint';
import type * as Types from './types';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => 'pong',
  } as Response);
});

describe('public SDK surface', () => {
  it('creates an email client with sending token auth and raw ping', async () => {
    const email = Lettermint.email('sending-token');

    await email.ping();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/ping',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-lettermint-token': 'sending-token',
        }),
      })
    );
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('creates an api client with bearer token auth and raw ping', async () => {
    const api = Lettermint.api('api-token');

    await api.ping();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/ping',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer api-token',
        }),
      })
    );
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty('x-lettermint-token');
  });

  it('lists blocked file types with bearer token auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        extensions: ['exe'],
        mime_types: ['application/x-msdownload'],
      }),
      text: async () => '',
    } as Response);
    const api = Lettermint.api('api-token');

    await expect(api.blockedFileTypes()).resolves.toEqual({
      extensions: ['exe'],
      mime_types: ['application/x-msdownload'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/blocked-file-types',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer api-token',
        }),
      })
    );
  });

  it('does not let custom headers override SDK auth headers', async () => {
    const client = new LettermintClient({ apiToken: 'api-token', authMode: 'api' });

    await client.get('/team', {
      headers: {
        Authorization: 'Bearer attacker',
        'x-lettermint-token': 'attacker',
      },
    });

    expect(mockFetch.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer api-token',
      })
    );
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty('x-lettermint-token');
  });

  it('posts batch email payloads to the sending API', async () => {
    const email = Lettermint.email('sending-token');
    const payload = [{ from: 'from@example.com', to: ['to@example.com'], subject: 'Hello' }];

    await email.sendBatch(payload);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/send/batch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  });
});

describe('api endpoint coverage', () => {
  const documentedMethods = {
    'domain.index': 'domains.list',
    'domain.store': 'domains.create',
    'domain.show': 'domains.retrieve',
    'domain.destroy': 'domains.delete',
    'domain.verifyDnsRecords': 'domains.verifyDnsRecords',
    'domain.verifySpecificDnsRecord': 'domains.verifyDnsRecord',
    'domain.updateProjects': 'domains.updateProjects',
    'v1.ping': 'ping',
    'v1.blockedFileTypes': 'blockedFileTypes',
    'message.index': 'messages.list',
    'message.show': 'messages.retrieve',
    'message.events': 'messages.events',
    'message.source': 'messages.source',
    'message.html': 'messages.html',
    'message.text': 'messages.text',
    'project.index': 'projects.list',
    'project.store': 'projects.create',
    'project.show': 'projects.retrieve',
    'project.update': 'projects.update',
    'project.destroy': 'projects.delete',
    'project.rotateToken': 'projects.rotateToken',
    'project.updateMembers': 'projects.updateMembers',
    'project.addMember': 'projects.addMember',
    'project.removeMember': 'projects.removeMember',
    'route.index': 'projects.routes',
    'route.store': 'projects.createRoute',
    'route.show': 'routes.retrieve',
    'route.update': 'routes.update',
    'route.destroy': 'routes.delete',
    'route.verifyInboundDomain': 'routes.verifyInboundDomain',
    'stats.index': 'stats.retrieve',
    'suppression.index': 'suppressions.list',
    'suppression.store': 'suppressions.create',
    'suppression.destroy': 'suppressions.delete',
    'team.show': 'team.retrieve',
    'team.update': 'team.update',
    'team.usage': 'team.usage',
    'team.members': 'team.members',
    'webhook.index': 'webhooks.list',
    'webhook.store': 'webhooks.create',
    'webhook.show': 'webhooks.retrieve',
    'webhook.update': 'webhooks.update',
    'webhook.destroy': 'webhooks.delete',
    'webhook.test': 'webhooks.test',
    'webhook.regenerateSecret': 'webhooks.regenerateSecret',
    'webhook.deliveries': 'webhooks.deliveries',
    'webhook.showDelivery': 'webhooks.delivery',
  } as const;

  it('exposes documented API operations', () => {
    const api = Lettermint.api('api-token') as unknown as Record<string, unknown>;

    for (const exposedPath of Object.values(documentedMethods)) {
      const segments = exposedPath.split('.');
      let cursor: unknown = api;

      for (const segment of segments) {
        cursor = (cursor as Record<string, unknown>)[segment];
      }

      expect(cursor).toBeDefined();
      expect(typeof cursor).toBe('function');
    }
  });
});

describe('generated api types', () => {
  it('matches current Team API schema additions', () => {
    const messageEvent: Types.MessageEventType = 'auto_replied';
    const webhookEvent: Types.WebhookEvent = 'message.auto_replied';
    const volumeTier: Types.VolumeTier = 300000;
    const suppression: Types.StoreSuppressionData = {
      reason: 'manual',
      scope: 'global',
      emails: ['blocked@example.com'],
    };
    const routeSettings: Types.UpdateRouteSettingsData = {
      redact_email_content: true,
      disable_plaintext_generation: false,
    };
    const routeInboundSettings: Types.UpdateRouteInboundSettingsData = {
      inbound_domain: 'inbound.example.com',
      inbound_spam_threshold: 3,
      attachment_delivery: 'url',
    };
    const routeUpdate: Types.UpdateRouteData = {
      settings: routeSettings,
      inbound_settings: routeInboundSettings,
    };
    const projectCreate: Types.StoreProjectData = {
      name: 'Production',
      short_token: true,
    };
    const project: Types.ProjectData = {
      id: 'project_123',
      name: 'Production',
      smtp_enabled: true,
      redact_email_content: true,
      default_route_id: null,
      token_generated_at: null,
      token_last_used_at: null,
      token_last_used_ip: null,
      created_at: '2026-06-28T00:00:00Z',
      updated_at: '2026-06-28T00:00:00Z',
    };
    const projectUpdate: Types.UpdateProjectData = {
      redact_email_content: false,
    };
    const blockedFileTypes: Types.BlockedFileTypesResponse = {
      extensions: ['exe'],
      mime_types: ['application/x-msdownload'],
    };

    expect({
      messageEvent,
      webhookEvent,
      volumeTier,
      suppression,
      routeUpdate,
      projectCreate,
      project,
      projectUpdate,
      blockedFileTypes,
    }).toBeDefined();
  });
});

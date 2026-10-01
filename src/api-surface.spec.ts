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

  it('maps reusable team role and member assignment endpoints', async () => {
    const api = Lettermint.api('api-token');
    const assignment: Types.TeamMembersAssignmentUpdateRequest = {
      role_id: 'role_123',
      project_access: { scope: 'all' },
    };

    await api.team.roles();
    await api.team.member('user/id');
    await api.team.updateMemberAssignment('user/id', assignment);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.lettermint.co/v1/team/roles',
      expect.objectContaining({ method: 'GET' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.lettermint.co/v1/team/members/user%2Fid',
      expect.objectContaining({ method: 'GET' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://api.lettermint.co/v1/team/members/user%2Fid/assignment',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(assignment),
      })
    );
  });

  it('reschedules, cancels, and processes messages', async () => {
    const api = Lettermint.api('api-token');
    await api.messages.reschedule('message/id', { scheduled_at: '2026-08-27T09:00:00Z' });
    await api.messages.cancel('message/id');
    await api.messages.process('message/id');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.lettermint.co/v1/messages/message%2Fid',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ scheduled_at: '2026-08-27T09:00:00Z' }),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.lettermint.co/v1/messages/message%2Fid/cancel',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://api.lettermint.co/v1/messages/message%2Fid/process',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api endpoint coverage', () => {
  const documentedMethods = {
    'v1.analytics': 'analytics',
    getReportForwarding: 'projects.retrieveReportForwarding',
    updateReportForwarding: 'projects.updateReportForwarding',
    deleteReportForwarding: 'projects.deleteReportForwarding',
    verifyReportForwarding: 'projects.verifyReportForwarding',
    resendReportForwardingCode: 'projects.resendReportForwardingCode',
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
    rescheduleMessage: 'messages.reschedule',
    cancelScheduledMessage: 'messages.cancel',
    processInboundMessage: 'messages.process',
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
    'team.roles': 'team.roles',
    'team.members': 'team.members',
    'team.members.show': 'team.member',
    'team.members.assignment.update': 'team.updateMemberAssignment',
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

    expect(Object.keys(documentedMethods)).toHaveLength(56);

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
    const builtInRole: Types.BuiltInTeamRole = 'admin';
    const suppression: Types.StoreSuppressionData = {
      reason: 'manual',
      scope: 'team',
      emails: ['blocked@example.com'],
    };
    const routeSettings: Types.UpdateRouteSettingsData = {
      redact_email_content: true,
      generate_plaintext_fallback: false,
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
      delivery_mode: 'sandbox',
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
      delivery_mode: 'sandbox',
    };
    const projectUpdate: Types.UpdateProjectData = {
      redact_email_content: false,
      delivery_mode: 'live',
    };
    const sendRequest: Types.SendMailRequest = {
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Sandbox test',
      sandbox_result: 'clicked',
    };
    const sendResponse: Types.SendEmailResponse = {
      message_id: 'message_123',
      status: 'pending',
      sandbox: true,
      sandbox_result: 'clicked',
    };
    const messageMode: Pick<Types.MessageData, 'delivery_mode' | 'sandbox_result'> = {
      delivery_mode: 'sandbox',
      sandbox_result: 'clicked',
    };
    const webhookCreate: Types.StoreWebhookData = {
      name: 'Sandbox webhook',
      url: 'https://example.com/webhooks',
      events: ['message.delivered'],
      delivery_mode_filter: 'both',
    };
    const webhookDelivery: Pick<Types.WebhookDeliveryData, 'sandbox'> = {
      sandbox: true,
    };
    const blockedFileTypes: Types.BlockedFileTypesResponse = {
      extensions: ['exe'],
      mime_types: ['application/x-msdownload'],
    };
    const teamRole: Types.TeamRoleData = {
      id: 'role_123',
      name: 'Admin',
      system_key: builtInRole,
      permissions: ['members:manage'],
      assignable: true,
    };
    const assignment: Types.UpdateTeamMemberAssignmentData = {
      role_id: 'role_123',
      project_access: { scope: 'selected', project_ids: ['project_123'] },
    };
    const messageTag: Types.MessageTag = { name: 'campaign', value: 'welcome' };
    const cursorPaginator: Types.CursorPaginator = {
      data: [],
      path: null,
      per_page: 25,
      next_cursor: null,
      next_page_url: null,
      prev_cursor: null,
      prev_page_url: null,
    };
    const rescheduleRequest: Types.RescheduleMessageRequest = {
      scheduled_at: '2026-10-01T09:00:00Z',
    };
    const rescheduleResponse: Types.RescheduleMessageResponse = {
      message_id: 'message_123',
      status: 'scheduled',
      scheduled_at: '2026-10-01T09:00:00Z',
    };
    const cancelResponse: Types.CancelScheduledMessageResponse = {
      message_id: 'message_123',
      status: 'canceled',
      scheduled_at: null,
    };

    expect({
      messageEvent,
      webhookEvent,
      builtInRole,
      suppression,
      routeUpdate,
      projectCreate,
      project,
      projectUpdate,
      sendRequest,
      sendResponse,
      messageMode,
      webhookCreate,
      webhookDelivery,
      blockedFileTypes,
      teamRole,
      assignment,
      messageTag,
      cursorPaginator,
      rescheduleRequest,
      rescheduleResponse,
      cancelResponse,
    }).toBeDefined();
  });
});

import {
  ApiError,
  ConflictError,
  type Lettermint,
  LettermintConfigError,
  type MessageResponse,
  NotFoundError,
  type PendingSendMailResponse,
  PermissionError,
  type ProjectApiToken,
  type ProjectApiTokenCreatedResponse,
  type RetryWebhookDeliveryResponse,
  type RouteData,
  type TeamApiToken,
  type TeamApiTokenCreatedResponse,
  type TeamInviteData,
  type TeamRoleData,
  ValidationError,
  type WebhookDeliveryData,
} from '../src';
import { type OperationKey, operations } from '../src/generated/operations';
import { SENDING_TOKEN, TEAM_TOKEN, client, json, rejection, text } from './helpers';

const ids = {
  domainId: 'domain/1',
  recordId: 'record 1',
  messageId: 'message?1',
  projectId: 'project#1',
  routeId: 'route_1',
  suppressionId: 'suppression_1',
  userId: 'user/id',
  webhookId: 'webhook_1',
  deliveryId: 'delivery_1',
  inviteId: 'invite/1',
  roleId: 'role/1',
  tokenId: 'token/1',
};

type Call = (lettermint: Lettermint) => Promise<unknown> | AsyncGenerator<unknown>;

/** Every operation of the API, called through its public SDK method. */
const calls: Record<OperationKey, Call> = {
  'DELETE /domains/{domainId}': (l) => l.domains.delete(ids.domainId),
  'DELETE /projects/{projectId}': (l) => l.projects.delete(ids.projectId),
  'DELETE /projects/{projectId}/api-tokens/{tokenId}': (l) =>
    l.projects.apiTokens.delete(ids.projectId, ids.tokenId),
  'DELETE /projects/{projectId}/report-forwarding': (l) =>
    l.projects.reportForwarding.delete(ids.projectId),
  'DELETE /routes/{routeId}': (l) => l.routes.delete(ids.routeId),
  'DELETE /suppressions/{suppressionId}': (l) => l.suppressions.delete(ids.suppressionId),
  'DELETE /team/api-tokens/{tokenId}': (l) => l.team.apiTokens.delete(ids.tokenId),
  'DELETE /team/invites/{inviteId}': (l) => l.team.invites.revoke(ids.inviteId),
  'DELETE /team/members/{userId}': (l) => l.team.members.remove(ids.userId),
  'DELETE /team/roles/{roleId}': (l) => l.team.deleteRole(ids.roleId),
  'DELETE /webhooks/{webhookId}': (l) => l.webhooks.delete(ids.webhookId),
  'GET /blocked-file-types': (l) => l.blockedFileTypes(),
  'GET /domains': (l) => l.domains.list(),
  'GET /domains/{domainId}': (l) => l.domains.retrieve(ids.domainId),
  'GET /messages': (l) => l.messages.list(),
  'GET /messages/{messageId}': (l) => l.messages.retrieve(ids.messageId),
  'GET /messages/{messageId}/events': (l) => l.messages.events(ids.messageId),
  'GET /messages/{messageId}/html': (l) => l.messages.html(ids.messageId),
  'GET /messages/{messageId}/source': (l) => l.messages.source(ids.messageId),
  'GET /messages/{messageId}/text': (l) => l.messages.text(ids.messageId),
  'GET /ping': (l) => l.ping(),
  'GET /projects': (l) => l.projects.list(),
  'GET /projects/{projectId}': (l) => l.projects.retrieve(ids.projectId),
  'GET /projects/{projectId}/api-tokens': (l) => l.projects.apiTokens.list(ids.projectId),
  'GET /projects/{projectId}/report-forwarding': (l) =>
    l.projects.reportForwarding.retrieve(ids.projectId),
  'GET /projects/{projectId}/routes': (l) => l.routes.list(ids.projectId),
  'GET /routes/{routeId}': (l) => l.routes.retrieve(ids.routeId),
  'GET /stats': (l) => l.stats.retrieve({ from: '2026-01-01', to: '2026-01-31' }),
  'GET /suppressions': (l) => l.suppressions.list(),
  'GET /team': (l) => l.team.retrieve(),
  'GET /team/api-tokens': (l) => l.team.apiTokens.list(),
  'GET /team/invites': (l) => l.team.invites.list(),
  'GET /team/invites/{inviteId}': (l) => l.team.invites.retrieve(ids.inviteId),
  'GET /team/members': (l) => l.team.members.list(),
  'GET /team/members/{userId}': (l) => l.team.members.retrieve(ids.userId),
  'GET /team/roles': (l) => l.team.roles(),
  'GET /team/roles/{roleId}': (l) => l.team.retrieveRole(ids.roleId),
  'GET /team/usage': (l) => l.team.usage(),
  'GET /webhooks': (l) => l.webhooks.list(),
  'GET /webhooks/{webhookId}': (l) => l.webhooks.retrieve(ids.webhookId),
  'GET /webhooks/{webhookId}/deliveries': (l) => l.webhooks.deliveries.list(ids.webhookId),
  'GET /webhooks/{webhookId}/deliveries/{deliveryId}': (l) =>
    l.webhooks.deliveries.retrieve(ids.webhookId, ids.deliveryId),
  'PATCH /messages/{messageId}': (l) =>
    l.messages.reschedule(ids.messageId, { scheduled_at: '2026-10-01T09:00:00Z' }),
  'POST /analytics': (l) => l.analytics({ metrics: ['accepted'] }),
  'POST /domains': (l) => l.domains.create({ domain: 'example.test' }),
  'POST /domains/{domainId}/dns-records/verify': (l) => l.domains.verifyDnsRecords(ids.domainId),
  'POST /domains/{domainId}/dns-records/{recordId}/verify': (l) =>
    l.domains.verifyDnsRecord(ids.domainId, ids.recordId),
  'POST /messages/{messageId}/cancel': (l) => l.messages.cancel(ids.messageId),
  'POST /messages/{messageId}/process': (l) => l.messages.process(ids.messageId),
  'POST /messages/{messageId}/resend': (l) =>
    l.messages.resend(ids.messageId, { recipients: ['b@example.test'] }),
  'POST /projects': (l) => l.projects.create({ name: 'Production' }),
  'POST /projects/{projectId}/api-tokens': (l) =>
    l.projects.apiTokens.create(ids.projectId, { name: 'Checkout service' }),
  'POST /projects/{projectId}/report-forwarding/resend-code': (l) =>
    l.projects.reportForwarding.resendCode(ids.projectId),
  'POST /projects/{projectId}/report-forwarding/verify': (l) =>
    l.projects.reportForwarding.verify(ids.projectId, { code: '123456' }),
  'POST /projects/{projectId}/rotate-token': (l) => l.projects.rotateToken(ids.projectId),
  'POST /projects/{projectId}/routes': (l) =>
    l.routes.create(ids.projectId, { name: 'Inbound', route_type: 'inbound' } as never),
  'POST /routes/{routeId}/verify-inbound-domain': (l) => l.routes.verifyInboundDomain(ids.routeId),
  'POST /send': (l) =>
    l.emails.send({ from: 'a@example.test', to: ['b@example.test'], subject: 'x' }),
  'POST /send/batch': (l) =>
    l.emails.sendBatch([{ from: 'a@example.test', to: ['b@example.test'], subject: 'x' }]),
  'POST /suppressions': (l) =>
    l.suppressions.create({
      reason: 'manual',
      scope: 'team',
      emails: ['blocked@example.test'],
    } as never),
  'POST /team/api-tokens': (l) =>
    l.team.apiTokens.create({ name: 'Deploys', abilities: ['read:domains'] }),
  'POST /team/invites': (l) =>
    l.team.invites.create({
      email: 'jane@example.test',
      role_id: 'role_1',
      project_access: { scope: 'all' },
    }),
  'POST /team/roles': (l) => l.team.createRole({ name: 'Support', permissions: ['members:read'] }),
  'POST /team/roles/{roleId}/duplicate': (l) =>
    l.team.duplicateRole(ids.roleId, { name: 'Support copy' }),
  'POST /webhooks': (l) =>
    l.webhooks.create({
      name: 'Hook',
      url: 'https://example.test/hook',
      events: ['message.sent'],
    } as never),
  'POST /webhooks/{webhookId}/deliveries/{deliveryId}/retry': (l) =>
    l.webhooks.deliveries.retry(ids.webhookId, ids.deliveryId),
  'POST /webhooks/{webhookId}/regenerate-secret': (l) => l.webhooks.regenerateSecret(ids.webhookId),
  'POST /webhooks/{webhookId}/test': (l) => l.webhooks.test(ids.webhookId),
  'PUT /domains/{domainId}/projects': (l) =>
    l.domains.updateProjects(ids.domainId, { project_ids: ['p'] }),
  'PUT /projects/{projectId}': (l) =>
    l.projects.update(ids.projectId, { name: 'Renamed' } as never),
  'PUT /projects/{projectId}/report-forwarding': (l) =>
    l.projects.reportForwarding.update(ids.projectId, {
      destination: 'reports@example.test',
    } as never),
  'PUT /routes/{routeId}': (l) => l.routes.update(ids.routeId, { name: 'Renamed' } as never),
  'PUT /team': (l) => l.team.update({ name: 'Acme' } as never),
  'PUT /team/members/{userId}/assignment': (l) =>
    l.team.members.updateAssignment(ids.userId, {
      role_id: 'role_1',
      project_access: { scope: 'all' },
    }),
  'PUT /team/invites/{inviteId}': (l) =>
    l.team.invites.update(ids.inviteId, {
      email: 'jane@example.test',
      role_id: 'role_1',
      project_access: { scope: 'all' },
    }),
  'PUT /team/roles/{roleId}': (l) =>
    l.team.updateRole(ids.roleId, { name: 'Support', permissions: ['members:read'] }),
  'PUT /webhooks/{webhookId}': (l) => l.webhooks.update(ids.webhookId, { basic_auth: null }),
};

function responseFor(key: OperationKey): Response {
  const { response } = operations[key];
  if (response.type === 'empty') return new Response(null, { status: 204 });
  if (response.type === 'text') return text(200, 'pong');
  return json(response.status[0], { data: [], next_cursor: null });
}

describe('operation coverage', () => {
  it('has an SDK method for every operation in the generated table', () => {
    expect(Object.keys(calls).sort()).toEqual(Object.keys(operations).sort());
    expect(Object.keys(operations)).toHaveLength(77);
  });

  it.each(Object.keys(calls) as OperationKey[])('%s', async (key) => {
    const operation = operations[key];
    const { lettermint, requests } = client({}, () => responseFor(key));
    await calls[key](lettermint);
    expect(requests).toHaveLength(1);
    const [request] = requests;
    const path = operation.path.replace(/\{(\w+)\}/g, (_, name: keyof typeof ids) =>
      encodeURIComponent(ids[name])
    );
    expect(request.method).toBe(operation.method);
    expect(request.url.replace(/\?.*$/, '')).toBe(`https://api.lettermint.co/v1${path}`);
    if (operation.auth === 'sending') {
      expect(request.headers['x-lettermint-token']).toBe(SENDING_TOKEN);
      expect(request.headers).not.toHaveProperty('Authorization');
    } else {
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
      expect(request.headers).not.toHaveProperty('x-lettermint-token');
    }
    expect(request.headers.Accept).toBe('application/json');
    if (operation.request) {
      expect(request.headers['Content-Type']).toBe('application/json');
    } else {
      expect(request.rawBody).toBeUndefined();
      expect(request.headers).not.toHaveProperty('Content-Type');
    }
  });
});

describe('request bodies and options', () => {
  it('sends request bodies as JSON', async () => {
    const { lettermint, requests } = client();
    const assignment = { role_id: 'role_123', project_access: { scope: 'all' as const } };
    await lettermint.team.members.updateAssignment('user/id', assignment);
    expect(requests[0].body).toEqual(assignment);
    await lettermint.messages.reschedule('message/id', { scheduled_at: '2026-08-27T09:00:00Z' });
    expect(requests[1].body).toEqual({ scheduled_at: '2026-08-27T09:00:00Z' });
  });

  it('sends an Idempotency-Key for processing an inbound message', async () => {
    const { lettermint, requests } = client({}, () => json(202, { data: { message_id: 'm' } }));
    await lettermint.messages.process('m', { idempotencyKey: 'process-1' });
    await lettermint.messages.process('m');
    expect(requests[0].headers['Idempotency-Key']).toBe('process-1');
    expect(requests[1].headers).not.toHaveProperty('Idempotency-Key');
  });

  it('resends a message to every or to some original recipients', async () => {
    const { lettermint, requests } = client({}, () =>
      json(202, { message_id: 'resent-1', status: 'pending' })
    );
    const result: PendingSendMailResponse = await lettermint.messages.resend('message/id');
    expect(result).toEqual({ message_id: 'resent-1', status: 'pending' });
    await lettermint.messages.resend('message/id', { recipients: ['jane@example.test'] });
    await lettermint.messages.resend('message/id', {}, { idempotencyKey: 'resend-1' });

    for (const request of requests) {
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://api.lettermint.co/v1/messages/message%2Fid/resend');
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
    }
    expect(requests[0].rawBody).toBeUndefined();
    expect(requests[0].headers).not.toHaveProperty('Content-Type');
    expect(requests[0].headers).not.toHaveProperty('Idempotency-Key');
    expect(requests[1].body).toEqual({ recipients: ['jane@example.test'] });
    expect(requests[1].headers['Content-Type']).toBe('application/json');
    expect(requests[2].body).toEqual({});
    expect(requests[2].headers['Idempotency-Key']).toBe('resend-1');
  });

  it('rejects a resend of a message whose content is no longer retained', async () => {
    const body = {
      error: { code: 'MESSAGE_CONTENT_UNAVAILABLE', message: 'The content is gone.' },
    };
    const { lettermint } = client({}, () => json(410, body));
    const error = await rejection(lettermint.messages.resend('m'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 410,
      code: 'MESSAGE_CONTENT_UNAVAILABLE',
    });
  });

  it('retries a webhook delivery without a body', async () => {
    const { lettermint, requests } = client({}, () =>
      json(202, { message: 'Retry queued.', delivery_id: 'delivery/1' })
    );
    const result: RetryWebhookDeliveryResponse = await lettermint.webhooks.deliveries.retry(
      'webhook/1',
      'delivery/1'
    );
    expect(result).toEqual({ message: 'Retry queued.', delivery_id: 'delivery/1' });
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe(
      'https://api.lettermint.co/v1/webhooks/webhook%2F1/deliveries/delivery%2F1/retry'
    );
    expect(requests[0].headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
    expect(requests[0].headers).not.toHaveProperty('x-lettermint-token');
    expect(requests[0].rawBody).toBeUndefined();
    expect(requests[0].headers).not.toHaveProperty('Content-Type');
    expect(requests[0].headers).not.toHaveProperty('Idempotency-Key');
  });

  it('rejects a retry of a delivery that cannot be retried', async () => {
    const body = {
      error: {
        code: 'WEBHOOK_DELIVERY_NOT_RETRYABLE',
        message: 'This delivery cannot be retried.',
      },
    };
    const { lettermint } = client({}, () => json(409, body));
    const error = await rejection(lettermint.webhooks.deliveries.retry('w', 'd'));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'WEBHOOK_DELIVERY_NOT_RETRYABLE',
      message: 'This delivery cannot be retried.',
    });
  });

  it.each(['2026-10-18T12:05:00Z', null])(
    'reads next_retry_at %p on a webhook delivery',
    async (nextRetryAt) => {
      const delivery = { id: 'delivery_1', status: 'failed', next_retry_at: nextRetryAt };
      const { lettermint } = client({}, (request) =>
        json(
          200,
          request.path.endsWith('/deliveries') ? { data: [delivery], next_cursor: null } : delivery
        )
      );
      const result: WebhookDeliveryData = await lettermint.webhooks.deliveries.retrieve('w', 'd');
      const typed: string | null | undefined = result.next_retry_at;
      expect(typed).toBe(nextRetryAt);
      const page = await lettermint.webhooks.deliveries.list('w');
      expect(page.data[0].next_retry_at).toBe(nextRetryAt);
    }
  );

  it.each([
    ['omit', {}],
    ['set', { basic_auth: { username: ' fixture user ', password: '' } }],
    ['remove', { basic_auth: null }],
  ])('keeps the %s webhook basic-auth state', async (_, state) => {
    const { lettermint, requests } = client({}, () =>
      json(200, { data: { has_basic_auth: true } })
    );
    const create = {
      name: 'Fixture',
      url: 'https://example.test/hook',
      events: ['message.sent'],
      ...state,
    };
    expect((await lettermint.webhooks.create(create)).data.has_basic_auth).toBe(true);
    expect((await lettermint.webhooks.update('webhook-id', state)).data.has_basic_auth).toBe(true);
    expect(requests[0].body).toEqual(create);
    expect(requests[1].body).toEqual(state);
  });

  it('sends analytics queries and report forwarding payloads', async () => {
    const analytics = {
      metrics: ['accepted', 'delivered'],
      include: ['summary', 'time_series'],
      interval: 'day',
      filters: [{ dimension: 'project', operator: 'eq', values: ['project/id'] }],
      sort: { metric: 'accepted', direction: 'desc' },
      limit: 10,
    } as const;
    const { lettermint, requests } = client({}, () =>
      json(200, {
        data: { summary: { metrics: { accepted: 12, delivery_rate: null } } },
        meta: { timezone: 'UTC' },
      })
    );
    const result = await lettermint.analytics(analytics as never);
    expect(result.meta.timezone).toBe('UTC');
    expect(requests[0].body).toEqual(analytics);
    await lettermint.projects.reportForwarding.update('project/id', {
      destination: 'reports@example.test',
    } as never);
    expect(requests[1].body).toEqual({ destination: 'reports@example.test' });
  });

  it.each(['incoming.example.com', null, undefined])(
    'keeps a %s inbound route domain',
    async (domain) => {
      const route = {
        id: 'route_1',
        project_id: 'project_1',
        slug: 'incoming',
        name: 'Incoming',
        route_type: 'inbound',
        is_default: false,
        created_at: '2026-10-01T12:00:00Z',
        updated_at: '2026-10-01T12:00:00Z',
        ...(domain === undefined ? {} : { inbound_route_domain: domain }),
      } as RouteData;
      const { lettermint } = client({}, () => json(200, route));
      const result = await lettermint.routes.retrieve('route_1');
      const typed: string | null | undefined = result.inbound_route_domain;
      expect(typed).toBe(domain);
      expect(result).toEqual(route);
    }
  );
});

describe('team members', () => {
  it('removes a member with the team token', async () => {
    const { lettermint, requests } = client({}, () => json(200, { message: 'Member removed.' }));
    const result: MessageResponse = await lettermint.team.members.remove('user/id');
    expect(result).toEqual({ message: 'Member removed.' });
    expect(requests[0].method).toBe('DELETE');
    expect(requests[0].url).toBe('https://api.lettermint.co/v1/team/members/user%2Fid');
    expect(requests[0].headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
    expect(requests[0].headers).not.toHaveProperty('x-lettermint-token');
    expect(requests[0].headers).not.toHaveProperty('Idempotency-Key');
    expect(requests[0].rawBody).toBeUndefined();
    expect(requests[0].headers).not.toHaveProperty('Content-Type');
  });

  it('rejects the removal of the Owner', async () => {
    const conflict = {
      error: { code: 'owner_protected', message: 'The Owner cannot be removed.' },
    };
    const { lettermint } = client({}, () => json(409, conflict));
    const error = await rejection(lettermint.team.members.remove('owner'));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'owner_protected',
      message: 'The Owner cannot be removed.',
    });
  });

  it('rejects the removal of an unknown member', async () => {
    const { lettermint } = client({}, () => json(404, { message: 'Not found.' }));
    const error = await rejection(lettermint.team.members.remove('missing'));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('filters the member list by project', async () => {
    const pages: Record<string, unknown> = {
      first: { data: [{ id: 'u1' }], next_cursor: 'c2' },
      c2: { data: [{ id: 'u2' }], next_cursor: null },
    };
    const { lettermint, requests } = client({}, (request) =>
      json(200, pages[request.query.get('page[cursor]') ?? 'first'])
    );
    await lettermint.team.members.list({ filter: { project_id: 'project/1' }, page: { size: 5 } });
    expect(requests[0].url).toBe(
      'https://api.lettermint.co/v1/team/members?filter%5Bproject_id%5D=project%2F1&page%5Bsize%5D=5'
    );
    const ids: string[] = [];
    for await (const member of lettermint.team.members.iterate({
      filter: { project_id: 'project/1' },
    })) {
      ids.push(member.id);
    }
    expect(ids).toEqual(['u1', 'u2']);
    expect(requests.slice(1).map((r) => Object.fromEntries(r.query))).toEqual([
      { 'filter[project_id]': 'project/1' },
      { 'filter[project_id]': 'project/1', 'page[cursor]': 'c2' },
    ]);
    await lettermint.team.members.list();
    expect(requests[3].url).toBe('https://api.lettermint.co/v1/team/members');
  });
});

describe('team invites', () => {
  const invite: TeamInviteData = {
    id: 'invite/1',
    email: 'jane@example.test',
    role: { id: 'role_1', name: 'Member' },
    project_access: { scope: 'selected', projects: [{ id: 'project_1', name: 'Production' }] },
    created_at: '2026-10-20T09:00:00Z',
  };
  const body = {
    email: 'jane@example.test',
    role_id: 'role_1',
    project_access: { scope: 'selected' as const, project_ids: ['project_1'] },
  };

  it('lists, retrieves, creates, updates and revokes invites with the team token', async () => {
    const { lettermint, requests } = client({}, (request) => {
      if (request.method === 'DELETE') return json(200, { message: 'Invite revoked.' });
      if (request.method === 'POST') return json(201, invite);
      if (request.path === '/team/invites') return json(200, { data: [invite], next_cursor: 'c2' });
      return json(200, invite);
    });

    const page = await lettermint.team.invites.list({ page: { size: 10, cursor: 'c1' } });
    expect(page).toEqual({ data: [invite], next_cursor: 'c2' });
    const retrieved: TeamInviteData = await lettermint.team.invites.retrieve('invite/1');
    expect(retrieved).toEqual(invite);
    const created: TeamInviteData = await lettermint.team.invites.create(body);
    expect(created).toEqual(invite);
    const updated: TeamInviteData = await lettermint.team.invites.update('invite/1', {
      ...body,
      project_access: { scope: 'all' },
    });
    expect(updated).toEqual(invite);
    const revoked = await lettermint.team.invites.revoke('invite/1');
    expect(revoked).toEqual({ message: 'Invite revoked.' });

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET https://api.lettermint.co/v1/team/invites?page%5Bsize%5D=10&page%5Bcursor%5D=c1',
      'GET https://api.lettermint.co/v1/team/invites/invite%2F1',
      'POST https://api.lettermint.co/v1/team/invites',
      'PUT https://api.lettermint.co/v1/team/invites/invite%2F1',
      'DELETE https://api.lettermint.co/v1/team/invites/invite%2F1',
    ]);
    for (const request of requests) {
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
      expect(request.headers).not.toHaveProperty('x-lettermint-token');
      expect(request.headers).not.toHaveProperty('Idempotency-Key');
    }
    expect(requests[2].body).toEqual(body);
    expect(requests[2].headers['Content-Type']).toBe('application/json');
    expect(requests[3].body).toEqual({ ...body, project_access: { scope: 'all' } });
    for (const index of [0, 1, 4]) {
      expect(requests[index].rawBody).toBeUndefined();
      expect(requests[index].headers).not.toHaveProperty('Content-Type');
    }
  });

  it('rejects an invite that conflicts with the team state', async () => {
    const conflict = {
      error: { code: 'owner_protected', message: 'The Owner role cannot be assigned.' },
    };
    const { lettermint } = client({}, () => json(409, conflict));
    const error = await rejection(lettermint.team.invites.create(body));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'owner_protected',
      message: 'The Owner role cannot be assigned.',
    });
  });

  it('rejects invalid invite data', async () => {
    const invalid = {
      message: 'The email field must be a valid email address.',
      errors: { email: ['The email field must be a valid email address.'] },
    };
    const { lettermint } = client({}, () => json(422, invalid));
    const error = await rejection(
      lettermint.team.invites.update('invite/1', { ...body, email: 'not-an-email' })
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 422, errors: invalid.errors });
  });
});

describe('team roles', () => {
  const role: TeamRoleData = {
    id: 'role/1',
    name: 'Support',
    description: 'Answers customer questions.',
    system_key: null,
    permissions: ['members:read'],
    assignable: true,
  };

  it('retrieves, creates, updates and duplicates roles with the team token', async () => {
    const { lettermint, requests } = client({}, (request) =>
      json(request.method === 'POST' ? 201 : 200, role)
    );
    const create = {
      name: 'Support',
      description: 'Answers customer questions.',
      permissions: ['members:read' as const],
    };

    const results: TeamRoleData[] = [
      await lettermint.team.retrieveRole('role/1'),
      await lettermint.team.createRole(create),
      await lettermint.team.createRole({ name: 'Billing', permissions: ['billing:manage'] }),
      await lettermint.team.updateRole('role/1', { ...create, description: null }),
      await lettermint.team.duplicateRole('role/1', { name: 'Support copy' }),
      await lettermint.team.duplicateRole('role/1', { name: 'Support EU', description: 'EU' }),
    ];
    for (const result of results) expect(result).toEqual(role);

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET https://api.lettermint.co/v1/team/roles/role%2F1',
      'POST https://api.lettermint.co/v1/team/roles',
      'POST https://api.lettermint.co/v1/team/roles',
      'PUT https://api.lettermint.co/v1/team/roles/role%2F1',
      'POST https://api.lettermint.co/v1/team/roles/role%2F1/duplicate',
      'POST https://api.lettermint.co/v1/team/roles/role%2F1/duplicate',
    ]);
    for (const request of requests) {
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
      expect(request.headers).not.toHaveProperty('x-lettermint-token');
      expect(request.headers).not.toHaveProperty('Idempotency-Key');
    }
    expect(requests[0].rawBody).toBeUndefined();
    expect(requests[1].body).toEqual(create);
    expect(requests[2].body).toEqual({ name: 'Billing', permissions: ['billing:manage'] });
    expect(requests[3].body).toEqual({ ...create, description: null });
    expect(requests[4].body).toEqual({ name: 'Support copy' });
    expect(requests[5].body).toEqual({ name: 'Support EU', description: 'EU' });
  });

  it.each(['Answers customer questions.', null, undefined])(
    'reads the role description %p',
    async (description) => {
      const { description: _, ...rest } = role;
      const body = description === undefined ? rest : { ...rest, description };
      const { lettermint } = client({}, (request) =>
        json(200, request.path === '/team/roles' ? { data: [body] } : body)
      );
      const result = await lettermint.team.retrieveRole('role/1');
      const typed: string | null | undefined = result.description;
      expect(typed).toBe(description);
      expect((await lettermint.team.roles()).data[0].description).toBe(description);
    }
  );

  it('deletes a role with or without a replacement role', async () => {
    const { lettermint, requests } = client({}, () => json(200, { message: 'Role deleted.' }));
    expect(await lettermint.team.deleteRole('role/1')).toEqual({ message: 'Role deleted.' });
    await lettermint.team.deleteRole('role/1', { replacement_role_id: 'role/2' });
    await lettermint.team.deleteRole('role/1', { replacement_role_id: null });

    for (const request of requests) {
      expect(request.method).toBe('DELETE');
      expect(request.path).toBe('/team/roles/role%2F1');
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
      expect(request.rawBody).toBeUndefined();
    }
    expect(requests[0].url).toBe('https://api.lettermint.co/v1/team/roles/role%2F1');
    expect(requests[1].url).toBe(
      'https://api.lettermint.co/v1/team/roles/role%2F1?replacement_role_id=role%2F2'
    );
    expect(requests[2].url).toBe('https://api.lettermint.co/v1/team/roles/role%2F1');
  });

  it('rejects a change to a built-in role', async () => {
    const conflict = {
      error: { code: 'built_in_role_immutable', message: 'Built-in roles cannot be changed.' },
    };
    const { lettermint } = client({}, () => json(409, conflict));
    for (const call of [
      () => lettermint.team.updateRole('role/1', { name: 'Admin', permissions: [] }),
      () => lettermint.team.deleteRole('role/1'),
    ]) {
      const error = await rejection(call());
      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 409,
        code: 'built_in_role_immutable',
        message: 'Built-in roles cannot be changed.',
      });
    }
  });

  it('rejects a role delete without a required replacement role', async () => {
    const invalid = {
      message: 'The replacement role id field is required.',
      errors: { replacement_role_id: ['The replacement role id field is required.'] },
    };
    const { lettermint } = client({}, () => json(422, invalid));
    const error = await rejection(lettermint.team.deleteRole('role/1'));
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 422, errors: invalid.errors });
  });
});

describe('project API tokens', () => {
  const token: ProjectApiToken = {
    id: 'token/1',
    project_id: 'project/1',
    name: 'Checkout service',
    short_token: false,
    created_via: 'api',
    allowed_ips: [],
    last_used_at: null,
    created_at: '2026-10-28T09:00:00Z',
  };
  const created: ProjectApiTokenCreatedResponse = {
    data: { ...token, token: 'lm_fixture_token_value' },
    smtp: { host: 'smtp.lettermint.co', ports: [465, 587], username: 'lettermint' },
    message: 'API token created.',
  };

  it('lists, creates and deletes project API tokens with the team token', async () => {
    const { lettermint, requests } = client({}, (request) => {
      if (request.method === 'DELETE') return json(200, { message: 'API token deleted.' });
      if (request.method === 'POST') return json(201, created);
      return json(200, { data: [token], next_cursor: 'c2' });
    });

    const page = await lettermint.projects.apiTokens.list('project/1', {
      page: { size: 10, cursor: 'c1' },
      sort: ['-created_at'],
    });
    expect(page).toEqual({ data: [token], next_cursor: 'c2' });
    const result: ProjectApiTokenCreatedResponse = await lettermint.projects.apiTokens.create(
      'project/1',
      { name: 'Checkout service' }
    );
    expect(result).toEqual(created);
    const value: string = result.data.token;
    expect(value).toBe('lm_fixture_token_value');
    await lettermint.projects.apiTokens.create('project/1', {
      name: 'Printer',
      short_token: true,
    });
    const deleted: MessageResponse = await lettermint.projects.apiTokens.delete(
      'project/1',
      'token/1'
    );
    expect(deleted).toEqual({ message: 'API token deleted.' });

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET https://api.lettermint.co/v1/projects/project%2F1/api-tokens?page%5Bsize%5D=10&page%5Bcursor%5D=c1&sort=-created_at',
      'POST https://api.lettermint.co/v1/projects/project%2F1/api-tokens',
      'POST https://api.lettermint.co/v1/projects/project%2F1/api-tokens',
      'DELETE https://api.lettermint.co/v1/projects/project%2F1/api-tokens/token%2F1',
    ]);
    for (const request of requests) {
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
      expect(request.headers).not.toHaveProperty('x-lettermint-token');
      expect(request.headers).not.toHaveProperty('Idempotency-Key');
    }
    expect(requests[1].body).toEqual({ name: 'Checkout service' });
    expect(requests[1].headers['Content-Type']).toBe('application/json');
    expect(requests[2].body).toEqual({ name: 'Printer', short_token: true });
    for (const index of [0, 3]) {
      expect(requests[index].rawBody).toBeUndefined();
      expect(requests[index].headers).not.toHaveProperty('Content-Type');
    }
  });

  it('reads a created token without SMTP settings', async () => {
    const { lettermint } = client({}, () => json(201, { ...created, smtp: null }));
    const result = await lettermint.projects.apiTokens.create('project/1', { name: 'API only' });
    const smtp: ProjectApiTokenCreatedResponse['smtp'] = result.smtp;
    expect(smtp).toBeNull();
    expect(result.data.token).toBe('lm_fixture_token_value');
  });

  it('rejects invalid token data', async () => {
    const invalid = {
      message: 'The name field is required.',
      errors: { name: ['The name field is required.'] },
    };
    const { lettermint } = client({}, () => json(422, invalid));
    const error = await rejection(lettermint.projects.apiTokens.create('project/1', { name: '' }));
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 422, errors: invalid.errors });
  });

  it('rejects the deletion of an unknown token', async () => {
    const { lettermint } = client({}, () => json(404, { message: 'Not found.' }));
    const error = await rejection(lettermint.projects.apiTokens.delete('project/1', 'missing'));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe('team API tokens', () => {
  const token: TeamApiToken = {
    id: 'token/1',
    name: 'Deploys',
    abilities: ['read:domains', 'write:domains'],
    allowed_ips: ['203.0.113.0/24'],
    created_via: 'api',
    expires_at: '2027-01-01T00:00:00Z',
    last_used_at: null,
    created_at: '2026-10-28T09:00:00Z',
  };
  const created: TeamApiTokenCreatedResponse = {
    data: { ...token, token: 'lm_team_fixture_token_value' },
    message: 'API token created.',
  };

  it('lists, creates and deletes team API tokens with the team token', async () => {
    const { lettermint, requests } = client({}, (request) => {
      if (request.method === 'DELETE') return json(200, { message: 'API token deleted.' });
      if (request.method === 'POST') return json(201, created);
      return json(200, { data: [token], next_cursor: 'c2' });
    });

    const page = await lettermint.team.apiTokens.list({
      page: { size: 10, cursor: 'c1' },
      sort: ['name'],
    });
    expect(page).toEqual({ data: [token], next_cursor: 'c2' });
    const result: TeamApiTokenCreatedResponse = await lettermint.team.apiTokens.create({
      name: 'Deploys',
      abilities: ['read:domains', 'write:domains'],
    });
    expect(result).toEqual(created);
    const value: string = result.data.token;
    expect(value).toBe('lm_team_fixture_token_value');
    await lettermint.team.apiTokens.create({
      name: 'Nightly',
      abilities: ['read:messages'],
      expires_at: '2026-12-01T00:00:00Z',
    });
    await lettermint.team.apiTokens.create({
      name: 'Until parent expires',
      abilities: ['read:messages'],
      expires_at: null,
    });
    const deleted: MessageResponse = await lettermint.team.apiTokens.delete('token/1');
    expect(deleted).toEqual({ message: 'API token deleted.' });

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET https://api.lettermint.co/v1/team/api-tokens?page%5Bsize%5D=10&page%5Bcursor%5D=c1&sort=name',
      'POST https://api.lettermint.co/v1/team/api-tokens',
      'POST https://api.lettermint.co/v1/team/api-tokens',
      'POST https://api.lettermint.co/v1/team/api-tokens',
      'DELETE https://api.lettermint.co/v1/team/api-tokens/token%2F1',
    ]);
    for (const request of requests) {
      expect(request.headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
      expect(request.headers).not.toHaveProperty('x-lettermint-token');
      expect(request.headers).not.toHaveProperty('Idempotency-Key');
    }
    expect(requests[1].body).toEqual({
      name: 'Deploys',
      abilities: ['read:domains', 'write:domains'],
    });
    expect(requests[1].headers['Content-Type']).toBe('application/json');
    expect(requests[2].body).toEqual({
      name: 'Nightly',
      abilities: ['read:messages'],
      expires_at: '2026-12-01T00:00:00Z',
    });
    expect(requests[3].body).toEqual({
      name: 'Until parent expires',
      abilities: ['read:messages'],
      expires_at: null,
    });
    for (const index of [0, 4]) {
      expect(requests[index].rawBody).toBeUndefined();
      expect(requests[index].headers).not.toHaveProperty('Content-Type');
    }
  });

  it('rejects an ability that the requesting token does not have', async () => {
    const invalid = {
      message: 'The abilities field contains an ability that this token does not have.',
      errors: { 'abilities.0': ['This token does not have the write:team ability.'] },
    };
    const { lettermint } = client({}, () => json(422, invalid));
    const error = await rejection(
      lettermint.team.apiTokens.create({ name: 'Billing', abilities: ['write:team'] })
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 422, errors: invalid.errors });
  });

  it('rejects the deletion of a token with abilities the requesting token lacks', async () => {
    const forbidden = { message: 'This action is unauthorized.' };
    const { lettermint } = client({}, () => json(403, forbidden));
    const error = await rejection(lettermint.team.apiTokens.delete('token/1'));
    expect(error).toBeInstanceOf(PermissionError);
    expect(error).toMatchObject({ status: 403 });
  });
});

describe('query parameters', () => {
  it('serializes nested objects to the bracket syntax', async () => {
    const { lettermint, requests } = client({}, () => json(200, { data: [], next_cursor: null }));
    await lettermint.domains.list({
      page: { size: 10, cursor: 'abc' },
      filter: { status: 'verified', domain: 'acme' },
      sort: ['-created_at', 'domain'],
    });
    expect(requests[0].query.get('page[size]')).toBe('10');
    expect(requests[0].query.get('page[cursor]')).toBe('abc');
    expect(requests[0].query.get('filter[status]')).toBe('verified');
    expect(requests[0].query.get('filter[domain]')).toBe('acme');
    expect(requests[0].query.get('sort')).toBe('-created_at,domain');
    expect([...requests[0].query.keys()]).toHaveLength(5);
  });

  it('serializes booleans as 1/0, tag pairs with indexes and skips undefined', async () => {
    const { lettermint, requests } = client({}, () => json(200, { data: [], next_cursor: null }));
    await lettermint.messages.list({
      filter: {
        tags: [
          { name: 'campaign', value: 'welcome' },
          { name: 'tier', value: 'gold' },
        ],
        status: undefined,
        search: 'hello world',
      },
    });
    expect(requests[0].url).toContain('filter%5Bsearch%5D=hello+world');
    expect(Object.fromEntries(requests[0].query)).toEqual({
      'filter[tags][0][name]': 'campaign',
      'filter[tags][0][value]': 'welcome',
      'filter[tags][1][name]': 'tier',
      'filter[tags][1][value]': 'gold',
      'filter[search]': 'hello world',
    });
    await lettermint.webhooks.list({ filter: { enabled: false }, cursor: 'c1', page: { size: 5 } });
    expect(Object.fromEntries(requests[1].query)).toEqual({
      'filter[enabled]': '0',
      cursor: 'c1',
      'page[size]': '5',
    });
    await lettermint.messages.events('m', { include_machine_events: true, page: { size: 2 } });
    expect(Object.fromEntries(requests[2].query)).toEqual({
      include_machine_events: '1',
      'page[size]': '2',
    });
    await lettermint.domains.retrieve('d', { include: ['dnsRecords', 'projects'] });
    expect(Object.fromEntries(requests[3].query)).toEqual({ include: 'dnsRecords,projects' });
    await lettermint.stats.retrieve({ from: '2026-01-01', to: '2026-01-31', project_id: null });
    expect(Object.fromEntries(requests[4].query)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });
});

describe('pagination', () => {
  it('follows next_cursor in page[cursor] until it is null', async () => {
    const pages: Record<string, unknown> = {
      first: { data: [{ id: 'd1' }, { id: 'd2' }], next_cursor: 'c2' },
      c2: { data: [{ id: 'd3' }], next_cursor: 'c3' },
      c3: { data: [], next_cursor: null },
    };
    const { lettermint, requests } = client({}, (request) =>
      json(200, pages[request.query.get('page[cursor]') ?? 'first'])
    );
    const ids: string[] = [];
    for await (const domain of lettermint.domains.iterate({
      page: { size: 2 },
      filter: { status: 'verified' },
    })) {
      ids.push(domain.id);
    }
    expect(ids).toEqual(['d1', 'd2', 'd3']);
    expect(requests.map((r) => Object.fromEntries(r.query))).toEqual([
      { 'page[size]': '2', 'filter[status]': 'verified' },
      { 'page[size]': '2', 'filter[status]': 'verified', 'page[cursor]': 'c2' },
      { 'page[size]': '2', 'filter[status]': 'verified', 'page[cursor]': 'c3' },
    ]);
  });

  it('uses the cursor parameter where the table says so', async () => {
    const { lettermint, requests } = client({}, (request) =>
      json(
        200,
        request.query.get('cursor')
          ? { data: [{ id: 'w2' }], next_cursor: null }
          : { data: [{ id: 'w1' }], next_cursor: 'next' }
      )
    );
    const ids: string[] = [];
    for await (const delivery of lettermint.webhooks.deliveries.iterate('hook/1'))
      ids.push(delivery.id);
    expect(ids).toEqual(['w1', 'w2']);
    expect(requests[1].url).toBe(
      'https://api.lettermint.co/v1/webhooks/hook%2F1/deliveries?cursor=next'
    );
    expect(operations['GET /webhooks/{webhookId}/deliveries'].pagination.cursorParam).toBe(
      'cursor'
    );
  });

  it.each([
    ['domains', (l: Lettermint) => l.domains.iterate()],
    ['messages', (l: Lettermint) => l.messages.iterate()],
    ['message events', (l: Lettermint) => l.messages.iterateEvents('m')],
    ['projects', (l: Lettermint) => l.projects.iterate()],
    ['project API tokens', (l: Lettermint) => l.projects.apiTokens.iterate('p')],
    ['routes', (l: Lettermint) => l.routes.iterate('p')],
    ['suppressions', (l: Lettermint) => l.suppressions.iterate()],
    ['team members', (l: Lettermint) => l.team.members.iterate()],
    ['team invites', (l: Lettermint) => l.team.invites.iterate()],
    ['team API tokens', (l: Lettermint) => l.team.apiTokens.iterate()],
    ['webhooks', (l: Lettermint) => l.webhooks.iterate()],
    ['webhook deliveries', (l: Lettermint) => l.webhooks.deliveries.iterate('w')],
  ])('iterates %s', async (_, iterate) => {
    const { lettermint, requests } = client({}, (_request, index) =>
      json(
        200,
        index === 0
          ? { data: [{ id: 1 }], next_cursor: 'n' }
          : { data: [{ id: 2 }], next_cursor: null }
      )
    );
    const items: unknown[] = [];
    for await (const item of iterate(lettermint)) items.push(item);
    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(requests).toHaveLength(2);
  });

  it('stops when the API repeats a cursor', async () => {
    const { lettermint, requests } = client({}, () =>
      json(200, { data: [{ id: 'x' }], next_cursor: 'same' })
    );
    const items: unknown[] = [];
    for await (const item of lettermint.projects.iterate()) items.push(item);
    expect(requests).toHaveLength(2);
    expect(items).toHaveLength(2);
  });

  it('stops early when the caller breaks', async () => {
    const { lettermint, requests } = client({}, () =>
      json(200, { data: [{ id: 'x' }, { id: 'y' }], next_cursor: 'n' })
    );
    for await (const _ of lettermint.suppressions.iterate()) break;
    expect(requests).toHaveLength(1);
  });
});

describe('path parameters', () => {
  it('encodes path parameters', async () => {
    const { lettermint, requests } = client();
    await lettermint.domains.verifyDnsRecord('domain/../x', 'record?a=b#c');
    expect(requests[0].url).toBe(
      'https://api.lettermint.co/v1/domains/domain%2F..%2Fx/dns-records/record%3Fa%3Db%23c/verify'
    );
  });

  it.each(['', '.', '..', undefined, 42])('rejects %p before any request', async (id) => {
    const { lettermint, fetch } = client();
    const error = await rejection(lettermint.domains.retrieve(id as string));
    expect(error).toBeInstanceOf(LettermintConfigError);
    expect(error.message).toBe(
      'domains.retrieve: `domainId` must be a non-empty string other than "." and "..".'
    );
    await expect(lettermint.webhooks.deliveries.retrieve('w', id as string)).rejects.toThrow(
      'webhooks.deliveries.retrieve: `deliveryId`'
    );
    await expect(lettermint.webhooks.deliveries.retry(id as string, 'd')).rejects.toThrow(
      'webhooks.deliveries.retry: `webhookId`'
    );
    await expect(lettermint.webhooks.deliveries.retry('w', id as string)).rejects.toThrow(
      'webhooks.deliveries.retry: `deliveryId`'
    );
    for (const call of [
      (l: Lettermint) => l.team.invites.retrieve(id as string),
      (l: Lettermint) =>
        l.team.invites.update(id as string, {
          email: 'jane@example.test',
          role_id: 'role_1',
          project_access: { scope: 'all' },
        }),
      (l: Lettermint) => l.team.invites.revoke(id as string),
    ]) {
      await expect(call(lettermint)).rejects.toThrow(/^team\.invites\.\w+: `inviteId` must be/);
    }
    for (const call of [
      (l: Lettermint) => l.team.retrieveRole(id as string),
      (l: Lettermint) => l.team.updateRole(id as string, { name: 'Support', permissions: [] }),
      (l: Lettermint) => l.team.deleteRole(id as string, { replacement_role_id: 'role_2' }),
      (l: Lettermint) => l.team.duplicateRole(id as string, { name: 'Support copy' }),
    ]) {
      await expect(call(lettermint)).rejects.toThrow(/^team\.\w+Role: `roleId` must be/);
    }
    await expect(lettermint.team.members.remove(id as string)).rejects.toThrow(
      'team.members.remove: `userId` must be'
    );
    for (const call of [
      (l: Lettermint) => l.projects.apiTokens.list(id as string),
      (l: Lettermint) => l.projects.apiTokens.iterate(id as string).next(),
      (l: Lettermint) => l.projects.apiTokens.create(id as string, { name: 'Checkout service' }),
      (l: Lettermint) => l.projects.apiTokens.delete(id as string, 'token_1'),
    ]) {
      await expect(call(lettermint)).rejects.toThrow(
        /^projects\.apiTokens\.\w+: `projectId` must be/
      );
    }
    await expect(lettermint.projects.apiTokens.delete('p', id as string)).rejects.toThrow(
      'projects.apiTokens.delete: `tokenId` must be'
    );
    await expect(lettermint.team.apiTokens.delete(id as string)).rejects.toThrow(
      'team.apiTokens.delete: `tokenId` must be'
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

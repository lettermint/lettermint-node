import { type Lettermint, LettermintConfigError, type RouteData } from '../src';
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
};

type Call = (lettermint: Lettermint) => Promise<unknown> | AsyncGenerator<unknown>;

/** Every operation of the API, called through its public SDK method. */
const calls: Record<OperationKey, Call> = {
  'DELETE /domains/{domainId}': (l) => l.domains.delete(ids.domainId),
  'DELETE /projects/{projectId}': (l) => l.projects.delete(ids.projectId),
  'DELETE /projects/{projectId}/report-forwarding': (l) =>
    l.projects.reportForwarding.delete(ids.projectId),
  'DELETE /routes/{routeId}': (l) => l.routes.delete(ids.routeId),
  'DELETE /suppressions/{suppressionId}': (l) => l.suppressions.delete(ids.suppressionId),
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
  'GET /projects/{projectId}/report-forwarding': (l) =>
    l.projects.reportForwarding.retrieve(ids.projectId),
  'GET /projects/{projectId}/routes': (l) => l.routes.list(ids.projectId),
  'GET /routes/{routeId}': (l) => l.routes.retrieve(ids.routeId),
  'GET /stats': (l) => l.stats.retrieve({ from: '2026-01-01', to: '2026-01-31' }),
  'GET /suppressions': (l) => l.suppressions.list(),
  'GET /team': (l) => l.team.retrieve(),
  'GET /team/members': (l) => l.team.members.list(),
  'GET /team/members/{userId}': (l) => l.team.members.retrieve(ids.userId),
  'GET /team/roles': (l) => l.team.roles(),
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
  'POST /projects': (l) => l.projects.create({ name: 'Production' }),
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
  'POST /webhooks': (l) =>
    l.webhooks.create({
      name: 'Hook',
      url: 'https://example.test/hook',
      events: ['message.sent'],
    } as never),
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
    expect(Object.keys(operations)).toHaveLength(58);
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
    ['routes', (l: Lettermint) => l.routes.iterate('p')],
    ['suppressions', (l: Lettermint) => l.suppressions.iterate()],
    ['team members', (l: Lettermint) => l.team.members.iterate()],
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
    expect(fetch).not.toHaveBeenCalled();
  });
});

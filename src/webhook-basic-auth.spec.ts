import { Lettermint } from './lettermint';
import type { WebhookBasicAuthData, WebhookStoreRequest, WebhookUpdateRequest } from './types';

const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { has_basic_auth: true } }) });
});

it.each([
  ['omit', {}],
  ['set', { basic_auth: { username: ' fixture user ', password: '' } }],
  ['remove', { basic_auth: null }],
])('keeps the %s credential state and API Bearer authentication', async (_, state) => {
  const api = Lettermint.api('fixture-token');
  const create: WebhookStoreRequest = {
    name: 'Fixture',
    url: 'https://example.test/hook',
    events: ['message.sent'],
    ...state,
  };
  const update: WebhookUpdateRequest = state;
  expect((await api.webhooks.create(create)).data.has_basic_auth).toBe(true);
  expect((await api.webhooks.update('webhook-id', update)).data.has_basic_auth).toBe(true);
  for (const [index, payload] of [create, update].entries()) {
    const [url, request] = fetchMock.mock.calls[index];
    expect(url).toBe(`https://api.lettermint.co/v1/webhooks${index ? '/webhook-id' : ''}`);
    expect(request.method).toBe(index ? 'PUT' : 'POST');
    expect(JSON.parse(request.body)).toEqual(payload);
    expect(request.headers.Authorization).toBe('Bearer fixture-token');
    expect(request.headers).not.toHaveProperty('x-lettermint-token');
  }
  const credentials: WebhookBasicAuthData = { username: 'fixture', password: '' };
  expect(credentials.password).toBe('');
});

it('keeps the Free-plan Sandbox 403 response', async () => {
  const body = {
    error: {
      code: 'FEATURE_NOT_AVAILABLE',
      message: 'Sandbox mode is available only on paid plans.',
    },
  };
  fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => body });
  await expect(
    Lettermint.email('fixture-token')
      .from('from@example.test')
      .to('to@example.test')
      .subject('Fixture')
      .send()
  ).rejects.toMatchObject({ statusCode: 403, responseBody: body });
});

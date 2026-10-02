import { resolve } from 'node:path';
import ts from 'typescript';
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

it('proves that old typed webhook fixtures need the required safe flag', () => {
  const filename = resolve(__dirname, '__old_webhook_caller__.ts');
  const source = `import type { WebhookData, WebhookListData, WebhookSecretData } from './types';
const legacy: Omit<WebhookData, 'has_basic_auth'> = {
  id: 'fixture', scope: 'route', project_ids: [], route_ids: [], route_id: null,
  name: 'Fixture', url: 'https://example.test/hook', events: [], enabled: true,
  include_machine_events: false, last_called_at: null, created_at: '', updated_at: '',
  delivery_mode_filter: 'both'
};
const detail: WebhookData = legacy;
const list: WebhookListData = legacy;
const secret: WebhookSecretData = { ...legacy, secret: 'synthetic-signing-secret' };
`;
  const compile = (text: string) => {
    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    };
    const host = ts.createCompilerHost(options);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, ...args) =>
      path === filename
        ? ts.createSourceFile(path, text, languageVersion, true)
        : read(path, languageVersion, ...args);
    return ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
  };
  const errors = compile(source);
  expect(errors).toHaveLength(3);
  for (const error of errors) {
    expect(error.code).toBe(2741);
    expect(ts.flattenDiagnosticMessageText(error.messageText, '\n')).toContain('has_basic_auth');
  }
  expect(
    compile(
      source
        .replace(
          "delivery_mode_filter: 'both'",
          "delivery_mode_filter: 'both', has_basic_auth: false"
        )
        .replace("Omit<WebhookData, 'has_basic_auth'>", 'WebhookData')
    )
  ).toHaveLength(0);
});

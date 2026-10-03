import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import type * as Types from '../src';
import type { NestedQuery, OperationResponse } from '../src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
const assertType = <T extends true>(_value?: T) => {};

describe('generated types', () => {
  it('uses the next-profile names and open enums', () => {
    const status: Types.MessageStatus = 'some_future_status';
    const event: Types.WebhookEvent = 'message.some_future_event';
    const known: Types.WebhookEvent = 'message.auto_replied';
    const tls: Types.TlsPolicy = 'enforced';
    const response: Types.SendMailResponse = {
      message_id: 'message_123',
      status: 'pending',
      sandbox: true,
      sandbox_result: 'clicked',
    };
    const scheduled: Types.SendMailResponse = {
      message_id: 'message_123',
      status: 'scheduled',
      scheduled_at: '2026-10-01T09:00:00Z',
    };
    const page: Types.ListDomainsResponse = {
      data: [],
      path: null,
      per_page: 30,
      next_cursor: null,
      next_page_url: null,
      prev_cursor: null,
      prev_page_url: null,
    };
    const created: Types.ProjectCreatedData = {
      data: {} as Types.ProjectData,
      message: 'Created',
      api_token: 'project-token',
    };
    const deleted: Types.DeleteSuppressionResponse = {
      success: true,
      message: 'Deleted',
      status: 'removed',
      confidence: 0.9,
    } as Types.DeleteSuppressionResponse;
    const credentials: Types.WebhookBasicAuthData = { username: 'fixture', password: '' };
    const errorBody: Types.ApiErrorBody = { error: { code: 'X', message: 'Y' } };
    const validationBody: Types.ValidationErrorBody = {
      message: 'x',
      errors: { to: ['required'] },
    };
    expect({
      status,
      event,
      known,
      tls,
      response,
      scheduled,
      page,
      created,
      deleted,
      credentials,
      errorBody,
      validationBody,
    }).toBeDefined();

    assertType<Equal<OperationResponse<'GET /domains'>, Types.ListDomainsResponse>>();
    assertType<Equal<Types.ListDomainsResponse, Types.CursorPage<Types.DomainListData>>>();
    assertType<
      Equal<OperationResponse<'PUT /projects/{projectId}'>, Types.ProjectMutationResponse>
    >();
    assertType<
      Equal<Types.SendMailResponse, Types.PendingSendMailResponse | Types.ScheduledSendMailResponse>
    >();
  });

  it('nests wire-name query parameters', () => {
    type Domains = NestedQuery<Types.ListDomainsQuery>;
    assertType<Equal<NonNullable<Domains['page']>, { size?: number; cursor?: string }>>();
    assertType<Equal<NonNullable<Domains['filter']>['status'], Types.DomainStatus | undefined>>();
    assertType<Equal<Domains['sort'], Types.ListDomainsQuerySortItem[] | undefined>>();
    type Webhooks = NestedQuery<Types.ListWebhooksQuery>;
    assertType<Equal<Webhooks['cursor'], string | undefined>>();
    assertType<Equal<NonNullable<Webhooks['filter']>['enabled'], boolean | undefined>>();
    type Messages = NonNullable<NestedQuery<Types.ListMessagesQuery>['filter']>;
    assertType<
      Equal<Messages['tags'], string | Types.ListMessagesQueryFilterTagsItem[] | undefined>
    >();
    type Stats = NestedQuery<Types.GetStatsQuery>;
    assertType<Equal<Stats['from'], string>>();
    const query: NestedQuery<Types.ListMessagesQuery> = {
      page: { size: 10 },
      filter: { status: 'delivered', tags: [{ name: 'campaign', value: 'welcome' }] },
      // @ts-expect-error wire-name keys are not part of the nested type
      'page[size]': 10,
    };
    expect(query).toBeDefined();
  });

  it('requires the has_basic_auth flag on webhook fixtures', () => {
    const filename = resolve(__dirname, '__old_webhook_caller__.ts');
    const source = `import type { WebhookData, WebhookListData, WebhookSecretData } from '../src';
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
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        resolveJsonModule: true,
        esModuleInterop: true,
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
    expect(errors.map((error) => error.code)).toEqual([2741, 2741, 2741]);
    for (const error of errors) {
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
});

describe('runtime-neutral source', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });

  it.each(files(resolve(__dirname, '../src')).map((path) => [path.split('/src/')[1], path]))(
    '%s uses no Node-only APIs',
    (_, path) => {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/from ['"]node:/);
      expect(source).not.toMatch(/require\(/);
      expect(source).not.toMatch(/\bBuffer\b/);
      expect(source).not.toMatch(/\bprocess\./);
    }
  );

  it('keeps the generated files untouched', () => {
    for (const name of ['types.ts', 'operations.ts']) {
      const source = readFileSync(resolve(__dirname, '../src/generated', name), 'utf8');
      expect(source.startsWith('// Generated by lettermint/sdk-generator — do not edit.\n')).toBe(
        true
      );
      expect(source).toMatch(/^\/\/ sending-openapi\.json SHA-256: [0-9a-f]{64}$/m);
      expect(source).toMatch(/^\/\/ team-openapi\.json SHA-256: [0-9a-f]{64}$/m);
      expect(source).toMatch(/^\/\/ Naming profile: next$/m);
    }
  });
});

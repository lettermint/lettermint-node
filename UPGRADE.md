# Upgrade guide

- [Upgrade from 2.x to 3.0](#upgrade-from-2x-to-30)
- [Upgrade from 1.x to 2.0](#upgrade-from-1x-to-20)

# Upgrade from 2.x to 3.0

3.0 is a new major version. The main reason is safety: in 2.x, `Lettermint.email(token)` returned one mutable builder per client. Two emails composed at the same time on one client could mix recipients, content and `Idempotency-Key`, and an email abandoned halfway (for example because `tags()` threw) leaked into the next send. 3.0 stores nothing about a message on the client.

## Highlights

- One client: `new Lettermint({ sendingToken, teamToken })`, or `new Lettermint(token)`. It replaces `Lettermint.email()` and `Lettermint.api()`.
- Sending is stateless: `emails.send(message, options)`, `emails.sendBatch(messages, options)` and an immutable `emails.compose()` builder. The `Idempotency-Key` is a per-call option.
- Each part uses its own token: `emails.*` uses the sending token, the Team API uses the team token. The SDK never falls back to the other token.
- Typed errors for every outcome, including empty or HTML responses, redirects, timeouts and network failures.
- Redirects are never followed, so tokens are never sent to another host.
- Tokens never appear in `console.log`, `util.inspect` or `JSON.stringify` output.
- Webhook verification is `async` (Web Crypto) and requires both signature headers.
- Typed query objects (`{ page: { size: 30 } }`) and `iterate()` helpers that follow `next_cursor`.
- Types are generated from the current API specification and use its names (see [Type names](#type-names)).
- Runs on Node.js 20+, Bun, Deno and edge runtimes. Node.js 18 is no longer supported.

## Requirements

- Node.js 20 or later (or Bun, Deno, Cloudflare Workers, Vercel Edge).
- TypeScript users: the type declarations need `lib: ["dom"]` or `@types/node` 20+ for `fetch`, `Headers` and `AbortSignal`.

## Create the client

`Lettermint.email()`, `Lettermint.api()`, `ApiClient`, `LettermintClient` and the `apiToken` option are removed.

```ts
// 2.x
import { Lettermint } from 'lettermint';
const email = Lettermint.email(process.env.LETTERMINT_SENDING_TOKEN!, { timeout: 10_000 });
const api = Lettermint.api(process.env.LETTERMINT_API_TOKEN!);
const legacy = new Lettermint({ apiToken: process.env.LETTERMINT_SENDING_TOKEN! });

// 3.0
import { Lettermint } from 'lettermint'; // or: import Lettermint from 'lettermint'
const lettermint = new Lettermint({
  sendingToken: process.env.LETTERMINT_SENDING_TOKEN, // for lettermint.emails.*
  teamToken: process.env.LETTERMINT_TEAM_TOKEN, // for the Team API
  timeout: 10_000,
});
```

Pass one token or both. With only one token, calling a part that needs the other throws `LettermintConfigError` (for example `domains.list needs `teamToken``) before any request.

You can also pass a token string. The SDK chooses the token type by its prefix:

```ts
const lettermint = new Lettermint('lm_team_...'); // team token
const lettermint = new Lettermint('lm_...'); // project sending token
const lettermint = new Lettermint(token, { timeout: 10_000 }); // with options
```

Any other format (SSO tokens, OAuth tokens, an empty string) throws `LettermintConfigError`. Use `{ sendingToken }` or `{ teamToken }` for those.

The `baseUrl` and `timeout` options work as before. A `fetch` option is new.

## Send an email

The builder lived on the client and was reset after each send. In 3.0, `emails.compose()` returns an immutable builder: each setter returns a new builder and leaves the old one unchanged. Chaining works as before. If you built an email over several statements, assign the result of each setter.

```ts
// 2.x
const email = Lettermint.email(token);
await email
  .from('Acme <hello@acme.com>')
  .to('jane@example.com')
  .subject('Welcome')
  .html('<p>Hi Jane</p>')
  .idempotencyKey('welcome-jane')
  .send();

// 3.0: builder
await lettermint.emails
  .compose()
  .from('Acme <hello@acme.com>')
  .to('jane@example.com')
  .subject('Welcome')
  .html('<p>Hi Jane</p>')
  .send({ idempotencyKey: 'welcome-jane' });

// 3.0: plain object (API field names)
await lettermint.emails.send(
  { from: 'Acme <hello@acme.com>', to: ['jane@example.com'], subject: 'Welcome', html: '<p>Hi Jane</p>' },
  { idempotencyKey: 'welcome-jane' }
);
```

```ts
// 2.x: statements mutated the shared builder
email.from('hello@acme.com');
email.to('jane@example.com');
if (copy) email.cc('team@acme.com');
await email.subject('Hi').send();

// 3.0: keep the returned builder
let draft = lettermint.emails.compose().from('hello@acme.com').to('jane@example.com');
if (copy) draft = draft.cc('team@acme.com');
await draft.subject('Hi').send();
```

A base builder can now be shared safely:

```ts
const welcome = lettermint.emails.compose().from('Acme <hello@acme.com>').subject('Welcome');
await welcome.to('jane@example.com').html(janeHtml).send();
await welcome.to('john@example.com').html(johnHtml).send({ idempotencyKey: 'welcome-john' });
```

### Changed builder methods

| 2.x | 3.0 |
| --- | --- |
| `email.from(x)` and the other setters change the client's builder and return it | Return a new builder: `compose().from(x)` |
| `.idempotencyKey(key).send()` | `.send({ idempotencyKey: key })` |
| `.attach(filename, base64, contentId?, contentType?)` | `.attach({ filename, content, contentType?, contentId? })`; `content` may also be a `Uint8Array` or `ArrayBuffer` |
| `.html(null)`, `.text(null)` were ignored | `null` removes the field; so does `tag(null)` and `scheduledAt(null)` |
| `.scheduledAt(string)` | `.scheduledAt(string \| Date)` |
| `.tags()` / `.tag()` threw `TypeError` | Throw `LettermintValidationError` (with `field`) |
| `email.send()` | `builder.send(options?)`; the builder can be sent again |
| — | `builder.build()` returns the message in API format |

Unchanged setters: `to`, `cc`, `bcc`, `replyTo` (each replaces its list), `subject`, `headers`, `metadata`, `route`, `settings`, `tag`, `tags`, `sandboxResult`.

Attachment content is base64-encoded by the SDK when you pass bytes, so `Buffer.from(...).toString('base64')` is no longer needed:

```ts
// 2.x
email.attach('invoice.pdf', pdfBuffer.toString('base64'), undefined, 'application/pdf');
email.attach('logo.png', logoBase64, 'logo');

// 3.0
builder
  .attach({ filename: 'invoice.pdf', content: pdfBytes, contentType: 'application/pdf' })
  .attach({ filename: 'logo.png', content: logoBase64, contentId: 'logo' });
```

## Batch sending and ping

```ts
// 2.x
await Lettermint.email(token).idempotencyKey('batch-1').sendBatch([message1, message2]);
await Lettermint.email(token).ping();
await Lettermint.api(token).ping();

// 3.0
await lettermint.emails.sendBatch([message1, message2], { idempotencyKey: 'batch-1' });
await lettermint.emails.sendBatch([builder1, builder2]); // builders work too
await lettermint.emails.ping(); // sending token
await lettermint.ping(); // team token if configured, otherwise the sending token
```

## Team API

The sub-clients move from `Lettermint.api(token).x` to `lettermint.x`. Query parameters are typed nested objects instead of `Record<string, string>` with bracket keys. Every list also has an `iterate()` method that follows `next_cursor`.

```ts
// 2.x
const api = Lettermint.api(token);
const page = await api.domains.list({ 'page[size]': '10', 'filter[status]': 'verified' });

// 3.0
const page = await lettermint.domains.list({ page: { size: 10 }, filter: { status: 'verified' } });
for await (const domain of lettermint.domains.iterate({ filter: { status: 'verified' } })) {
  console.log(domain.domain);
}
```

| 2.x (`api = Lettermint.api(token)`) | 3.0 (`lettermint = new Lettermint({ teamToken })`) |
| --- | --- |
| `api.ping()` | `lettermint.ping()` |
| `api.blockedFileTypes()` | `lettermint.blockedFileTypes()` |
| `api.analytics(payload)` | `lettermint.analytics(query)` |
| `api.domains.list(params)` | `lettermint.domains.list(query)`, `lettermint.domains.iterate(query)` |
| `api.domains.create(payload)` | `lettermint.domains.create(payload)` |
| `api.domains.retrieve(id)` | `lettermint.domains.retrieve(id, query?)` (`{ include: ['dnsRecords'] }`) |
| `api.domains.delete(id)` | `lettermint.domains.delete(id)` |
| `api.domains.verifyDnsRecords(id)` | `lettermint.domains.verifyDnsRecords(id)` |
| `api.domains.verifyDnsRecord(id, recordId)` | `lettermint.domains.verifyDnsRecord(id, recordId)` |
| `api.domains.updateProjects(id, payload)` | `lettermint.domains.updateProjects(id, payload)` |
| `api.messages.list(params)` | `lettermint.messages.list(query)`, `lettermint.messages.iterate(query)` |
| `api.messages.retrieve(id)` | `lettermint.messages.retrieve(id)` |
| `api.messages.events(id)` | `lettermint.messages.events(id, query?)`, `lettermint.messages.iterateEvents(id, query?)` |
| `api.messages.source(id)` / `.html(id)` / `.text(id)` | unchanged, on `lettermint.messages` |
| `api.messages.reschedule(id, payload)` | `lettermint.messages.reschedule(id, payload)` |
| `api.messages.cancel(id)` | `lettermint.messages.cancel(id)` |
| `api.messages.process(id)` | `lettermint.messages.process(id, { idempotencyKey? })` |
| `api.projects.list(params)` | `lettermint.projects.list(query)`, `lettermint.projects.iterate(query)` |
| `api.projects.create(payload)` | `lettermint.projects.create(payload)` |
| `api.projects.retrieve(id)` | `lettermint.projects.retrieve(id, query?)` |
| `api.projects.update(id, payload)` | `lettermint.projects.update(id, payload)` |
| `api.projects.delete(id)` | `lettermint.projects.delete(id)` |
| `api.projects.rotateToken(id)` | `lettermint.projects.rotateToken(id)` (deprecated by the API) |
| `api.projects.routes(projectId, params)` | `lettermint.routes.list(projectId, query)`, `lettermint.routes.iterate(projectId, query)` |
| `api.projects.createRoute(projectId, payload)` | `lettermint.routes.create(projectId, payload)` |
| `api.projects.retrieveReportForwarding(id)` | `lettermint.projects.reportForwarding.retrieve(id)` |
| `api.projects.updateReportForwarding(id, payload)` | `lettermint.projects.reportForwarding.update(id, payload)` |
| `api.projects.deleteReportForwarding(id)` | `lettermint.projects.reportForwarding.delete(id)` |
| `api.projects.verifyReportForwarding(id, payload)` | `lettermint.projects.reportForwarding.verify(id, payload)` |
| `api.projects.resendReportForwardingCode(id)` | `lettermint.projects.reportForwarding.resendCode(id)` |
| `api.routes.retrieve(id)` | `lettermint.routes.retrieve(id, query?)` |
| `api.routes.update(id, payload)` | `lettermint.routes.update(id, payload)` |
| `api.routes.delete(id)` | `lettermint.routes.delete(id)` |
| `api.routes.verifyInboundDomain(id)` | `lettermint.routes.verifyInboundDomain(id)` |
| `api.stats.retrieve(params)` | `lettermint.stats.retrieve({ from, to, project_id?, include_machine? })` |
| `api.suppressions.list(params)` | `lettermint.suppressions.list(query)`, `lettermint.suppressions.iterate(query)` |
| `api.suppressions.create(payload)` | `lettermint.suppressions.create(payload)` |
| `api.suppressions.delete(id)` | `lettermint.suppressions.delete(id)` |
| `api.team.retrieve()` | `lettermint.team.retrieve(query?)` (`{ include: ['features'] }`) |
| `api.team.update(payload)` | `lettermint.team.update(payload)` |
| `api.team.usage(params)` | `lettermint.team.usage()` (the endpoint takes no parameters) |
| `api.team.roles()` | `lettermint.team.roles()` |
| `api.team.members(params)` | `lettermint.team.members.list(query)`, `lettermint.team.members.iterate(query)` |
| `api.team.member(userId)` | `lettermint.team.members.retrieve(userId)` |
| `api.team.updateMemberAssignment(userId, payload)` | `lettermint.team.members.updateAssignment(userId, payload)` |
| `api.webhooks.list(params)` | `lettermint.webhooks.list(query)`, `lettermint.webhooks.iterate(query)` |
| `api.webhooks.create(payload)` | `lettermint.webhooks.create(payload)` |
| `api.webhooks.retrieve(id)` | `lettermint.webhooks.retrieve(id)` |
| `api.webhooks.update(id, payload)` | `lettermint.webhooks.update(id, payload)` |
| `api.webhooks.delete(id)` | `lettermint.webhooks.delete(id)` |
| `api.webhooks.test(id)` | `lettermint.webhooks.test(id)` |
| `api.webhooks.regenerateSecret(id)` | `lettermint.webhooks.regenerateSecret(id)` |
| `api.webhooks.deliveries(id, params)` | `lettermint.webhooks.deliveries.list(id, query)`, `lettermint.webhooks.deliveries.iterate(id, query)` |
| `api.webhooks.delivery(id, deliveryId)` | `lettermint.webhooks.deliveries.retrieve(id, deliveryId)` |

Every method also takes a last `options` argument: `{ signal?: AbortSignal, timeout?: number }`.

`messages.reschedule()` and `messages.cancel()` accept either token: the team token when configured, otherwise the sending token. This lets a sending-only client cancel the scheduled email it sent.

### Query parameters

Write bracketed names as nested objects. Arrays of values are joined with commas, arrays of objects are indexed, and booleans are sent as `1`/`0`.

| 2.x | 3.0 |
| --- | --- |
| `{ 'page[size]': '30', 'page[cursor]': c }` | `{ page: { size: 30, cursor: c } }` |
| `{ 'filter[status]': 'verified' }` | `{ filter: { status: 'verified' } }` |
| `{ sort: '-created_at,domain' }` | `{ sort: ['-created_at', 'domain'] }` |
| `{ 'filter[tags][0][name]': 'a', 'filter[tags][0][value]': 'b' }` | `{ filter: { tags: [{ name: 'a', value: 'b' }] } }` |
| `{ 'filter[enabled]': 'true' }` | `{ filter: { enabled: true } }` |
| webhooks: `{ cursor: c }` | unchanged: `{ cursor: c }` (these lists use `cursor`, not `page[cursor]`) |

### Path parameters

IDs are still URL-encoded. An empty ID, `.` or `..` now throws `LettermintConfigError` before the request.

### Message lists

The 2.x types described message and event lists with a nested `meta` object. The API returns a flat cursor page, which 3.0 types as `CursorPage<T>`: read `page.next_cursor`, not `page.meta.next_cursor`. Or use `iterate()`.

## Errors

`HttpRequestError` and `ClientError` are removed. Every SDK error extends `LettermintError` and has an explicit `name`, so `error.name` is readable in logs (2.x was minified, so names could show as `a`).

| Situation | 2.x | 3.0 |
| --- | --- | --- |
| HTTP 400 | `ClientError` (`statusCode`, `responseBody`) | `ApiError` (`status`, `code`, `message`, `details`, `body`) |
| HTTP 401 | `HttpRequestError` | `AuthenticationError` |
| HTTP 403 | `HttpRequestError` | `PermissionError` |
| HTTP 404 | `HttpRequestError` | `NotFoundError` |
| HTTP 409 | `HttpRequestError` | `ConflictError` |
| HTTP 422 | `ValidationError` (`statusCode`, `errorType`, `responseBody`) | `ValidationError` (`status`, `code`, `errors`, `body`) |
| HTTP 429 | `HttpRequestError` | `RateLimitError` (`retryAfter` in seconds) |
| HTTP 5xx | `HttpRequestError` | `ServerError` |
| Other 4xx | `HttpRequestError` | `ApiError` |
| Empty or invalid JSON body, HTML error page | raw `SyntaxError` | `UnexpectedResponseError` (`status`, `bodyExcerpt`) |
| Redirect (3xx) | followed, with the token | `RedirectError` (`status`); never followed |
| Timeout | `TimeoutError` (headers only) | `TimeoutError` (`timeout`); covers headers and body |
| Network failure | raw `TypeError` | `ConnectionError` (`cause`) |
| Invalid tags | `TypeError` | `LettermintValidationError` (`field`) |
| Missing or wrong token, bad option | — | `LettermintConfigError` |

Property renames: `statusCode` → `status`, `responseBody` → `body`, `errorType` → `code`. `code` comes from `{ error: { code } }`, or from a string `error` field. `message` is the API's message, or the HTTP status text.

```ts
// 2.x
try {
  await email.send();
} catch (error) {
  if (error instanceof ValidationError) console.log(error.statusCode, error.errorType, error.responseBody);
  else if (error instanceof HttpRequestError && error.statusCode === 429) retryLater();
}

// 3.0
import { RateLimitError, ValidationError } from 'lettermint';
try {
  await builder.send();
} catch (error) {
  if (error instanceof ValidationError) console.log(error.status, error.code, error.errors);
  else if (error instanceof RateLimitError) retryLater(error.retryAfter);
}
```

The SDK does not retry requests. Pass an `idempotencyKey` when you retry a send.

User cancellation through `signal` rejects with the signal's `reason` (an `AbortError` by default), not an SDK error.

## Webhooks

`verify()` is now `async`, takes the body first and the headers second, and replaces `verifyHeaders()`. The old `verify(payload, signature, timestamp?)` is now `verifySignature()`. Both return the typed payload (`WebhookPayload`) instead of `unknown`.

```ts
// 2.x
const webhook = new Webhook(secret);
const payload = webhook.verifyHeaders(req.headers, rawBody);
const payload2 = webhook.verify(rawBody, signatureHeader, Number(deliveryHeader));

// 3.0
const webhook = new Webhook(secret);
const event = await webhook.verify(rawBody, req.headers); // Node headers or a Fetch Headers object
const event2 = await webhook.verifySignature(rawBody, signatureHeader, deliveryHeader);
```

- The body may be a `string`, `Uint8Array` (including `Buffer`) or `ArrayBuffer`.
- Both `X-Lettermint-Signature` and `X-Lettermint-Delivery` are required, as in 2.8.
- `WebhookVerificationError` has a `reason`: `signature_header_missing`, `signature_header_malformed`, `delivery_header_missing`, `delivery_timestamp_mismatch`, `timestamp_out_of_tolerance`, `signature_mismatch`, `body_invalid` or `payload_invalid`.
- An empty secret or an invalid `tolerance` throws `LettermintConfigError` (2.x: `WebhookVerificationError`).

## Type names

The types are generated from the API specification of lettermint#2582 and use its names. Types that are not listed below keep their name. Some shapes also changed:

- Enums are open: `MessageStatus` is `'pending' | ... | (string & {})`, so values the API adds later still type-check. Give `switch` statements a `default` branch.
- `SendMailResponse` is `PendingSendMailResponse | ScheduledSendMailResponse`; narrow on `status`.
- `MessageTag` describes tags in responses; `MessageTagInput` describes tags you send.
- Message and event lists are `CursorPage<T>` (see [Message lists](#message-lists)).
- The generated `ApiError` and `ValidationError` body types are exported as `ApiErrorBody` and `ValidationErrorBody`, because `ApiError` and `ValidationError` are error classes.

| 2.x | 3.0 |
| --- | --- |
| `AnalyticsRequest` | `AnalyticsQuery` |
| `BlockedFileTypesResponse` | `BlockedFileTypes` |
| `CancelScheduledMessageResponse` | `ScheduledMessage` |
| `CursorPaginator` | `CursorPage<T>` |
| `DomainDestroyResponse` | `MessageResponse` |
| `DomainIndexResponse` | `ListDomainsResponse` |
| `DomainShowResponse` | `DomainData` |
| `DomainStoreRequest` | `StoreDomainData` |
| `DomainStoreResponse` | `DomainData` |
| `DomainUpdateProjectsRequest` | `UpdateDomainProjectsData` |
| `DomainUpdateProjectsResponse` | `DomainMutationResponse` |
| `DomainVerifyDnsRecordsResponse` | `DnsVerificationSuccessResponse` |
| `DomainVerifySpecificDnsRecordResponse` | `MessageResponse` |
| `EmailPayload` | `SendMailRequest` (or `EmailMessage`, which also accepts binary attachments) |
| `MessageEventsResponse` | `ListMessageEventsResponse` |
| `MessageIndexResponse` | `ListMessagesResponse` |
| `MessageShowResponse` | `MessageData` |
| `PingResponse` | `string` |
| `ProjectDestroyResponse` | `MessageResponse` |
| `ProjectIndexResponse` | `ListProjectsResponse` |
| `ProjectRotateTokenResponse` | `RotateProjectTokenResponse` |
| `ProjectShowResponse` | `ProjectData` |
| `ProjectStoreRequest` | `StoreProjectData` |
| `ProjectStoreResponse` | `ProjectCreatedData` |
| `ProjectUpdateRequest` | `UpdateProjectData` |
| `ProjectUpdateResponse` | `ProjectMutationResponse` |
| `RescheduleMessageResponse` | `ScheduledMessage` |
| `RouteDestroyResponse` | `MessageResponse` |
| `RouteIndexResponse` | `ListRoutesResponse` |
| `RouteShowResponse` | `RouteData` |
| `RouteStoreRequest` | `StoreRouteData` |
| `RouteStoreResponse` | `RouteMutationResponse` |
| `RouteUpdateRequest` | `UpdateRouteData` |
| `RouteUpdateResponse` | `RouteMutationResponse` |
| `RouteVerifyInboundDomainResponse` | `InboundDomainVerificationResponse` |
| `SendBatchEmailResponse` | `SendBatchMailResponse` |
| `SendEmailResponse` | `SendMailResponse` |
| `StatsIndexResponse` | `StatsData` |
| `SuppressionDestroyResponse` | `DeleteSuppressionResponse` |
| `SuppressionIndexResponse` | `ListSuppressionsResponse` |
| `SuppressionStoreRequest` | `StoreSuppressionData` |
| `TeamMembersAssignmentUpdateRequest` | `UpdateTeamMemberAssignmentData` |
| `TeamMembersAssignmentUpdateResponse` | `TeamMemberData` |
| `TeamMembersResponse` | `ListTeamMembersResponse` |
| `TeamMembersShowResponse` | `TeamMemberData` |
| `TeamRolesResponse` | `TeamRoleListResponse` |
| `TeamShowResponse` | `TeamData` |
| `TeamUpdateRequest` | `UpdateTeamData` |
| `TeamUpdateResponse` | `TeamMutationResponse` |
| `TeamUsageResponse` | `TeamUsageDetailData` |
| `UpdateReportForwardingRequest` | `ReportForwardingRequest` |
| `WebhookDeliveriesResponse` | `ListWebhookDeliveriesResponse` |
| `WebhookDestroyResponse` | `MessageResponse` |
| `WebhookIndexResponse` | `ListWebhooksResponse` |
| `WebhookRegenerateSecretResponse` | `WebhookSecretResponse` |
| `WebhookShowDeliveryResponse` | `WebhookDeliveryData` |
| `WebhookShowResponse` | `WebhookData` |
| `WebhookStoreRequest` | `StoreWebhookData` |
| `WebhookStoreResponse` | `WebhookSecretResponse` |
| `WebhookTestResponse` | `TestWebhookResponse` |
| `WebhookUpdateRequest` | `UpdateWebhookData` |
| `WebhookUpdateResponse` | `WebhookMutationResponse` |

### Removed types

lettermint#2582 removed these schemas from the API specification:

| 2.x | 3.0 |
| --- | --- |
| `AnalyticsResponseData` | Removed. Use `AnalyticsResponse` (`data: AnalyticsResults`). |
| `StatsRequestData` | Removed. Use `GetStatsQuery`, the parameters of `stats.retrieve()`. |
| Message list `meta` (`MessageIndexResponseMeta`) | Removed; not exported by 2.x. Lists are flat `CursorPage<T>`. |
| Message events `meta` (`MessageEventsResponseMeta`) | Removed; not exported by 2.x. |
| `SuppressionStoreResponseMessage1` | Removed; not exported by 2.x. `SuppressionStoreResponse.message` is a `string`. |

### Removed classes and helpers

| 2.x | 3.0 |
| --- | --- |
| `Lettermint.email(token, config)` | `new Lettermint({ sendingToken, ...config }).emails` |
| `Lettermint.api(token, config)` | `new Lettermint({ teamToken, ...config })` |
| `new Lettermint({ apiToken })`, `lettermint.email` | `new Lettermint({ sendingToken })`, `lettermint.emails` |
| `ApiClient` | `Lettermint` |
| `EmailEndpoint` | `Emails` (type) and `EmailBuilder` (type) from `lettermint.emails.compose()` |
| `Endpoint`, `DomainsEndpoint`, `MessagesEndpoint`, `ProjectsEndpoint`, `RoutesEndpoint`, `StatsEndpoint`, `SuppressionsEndpoint`, `TeamEndpoint`, `WebhooksEndpoint` | `Domains`, `Messages`, `Projects`, `Routes`, `Stats`, `Suppressions`, `Team`, `Webhooks` (types only; use the properties of `Lettermint`) |
| `LettermintClient` (`get`, `post`, `put`, `patch`, `delete`, `getRaw`) | Removed. Every documented endpoint has a method. |
| `LettermintClientConfig` | `LettermintOptions` |
| `RequestConfig` | `RequestOptions` (`signal`, `timeout`) and `SendOptions` (`idempotencyKey`) |
| `QueryParams` | Typed query objects: `NestedQuery<ListDomainsQuery>` and so on |
| `HttpRequestError`, `ClientError` | `ApiError` and its subclasses |
| `Webhook.verifyHeaders(headers, body)` | `await Webhook.verify(body, headers)` |
| `Webhook.verify(body, signature, timestamp)` | `await Webhook.verifySignature(body, signature, timestamp)` |

# Upgrade from 1.x to 2.0

This guide covers upgrading from the latest released v1 Node SDK to v2.

## Highlights

- Sending email now lives behind `Lettermint.email(token)`.
- The full Lettermint API is available through `Lettermint.api(token)`.
- Sending tokens use `x-lettermint-token`; full API tokens use `Authorization: Bearer`.
- `ping()` returns the raw trimmed `pong` response.
- Request and response types are generated from the OpenAPI specs and exported from the package.

## Replace Client Construction

```ts
import { Lettermint } from 'lettermint';

const email = Lettermint.email(process.env.LETTERMINT_SENDING_TOKEN!);
const api = Lettermint.api(process.env.LETTERMINT_API_TOKEN!);
```

Existing `new Lettermint({ apiToken })` email-builder usage still works for sending email.

## Batch Sending

```ts
await Lettermint.email(token).sendBatch([
  { from: 'sender@example.com', to: ['user@example.com'], subject: 'Hello', text: 'Hi' },
]);
```

## Full API

```ts
const domains = await Lettermint.api(token).domains.list();
const messageHtml = await Lettermint.api(token).messages.html('message-id');
```

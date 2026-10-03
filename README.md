# Lettermint Node.js SDK

![NPM Version](https://img.shields.io/npm/v/lettermint)
![NPM Downloads](https://img.shields.io/npm/dm/lettermint)
[![Join our Discord server](https://img.shields.io/discord/1305510095588819035?logo=discord&logoColor=eee&label=Discord&labelColor=464ce5&color=0D0E28&cacheSeconds=43200)](https://lettermint.co/r/discord)

The official JavaScript and TypeScript SDK for [Lettermint](https://lettermint.co). It runs on Node.js 20+, Bun, Deno and edge runtimes, and has no dependencies.

Upgrading from 2.x? Read [UPGRADE.md](UPGRADE.md).

## Installation

```bash
npm install lettermint
```

## Quick start

Create a client with a project sending token and send an email:

```ts
import { Lettermint } from 'lettermint';

const lettermint = new Lettermint({ sendingToken: process.env.LETTERMINT_PROJECT_TOKEN });

const result = await lettermint.emails.send({
  from: 'Acme <hello@acme.com>',
  to: ['jane@example.com'],
  subject: 'Welcome to Acme',
  html: '<p>Thanks for signing up.</p>',
  text: 'Thanks for signing up.',
});

console.log(result.message_id, result.status); // "…", "pending"
```

`import Lettermint from 'lettermint'` and `const { Lettermint } = require('lettermint')` work as well.

## Tokens

Lettermint has two kinds of API tokens:

| Option | Token | Used by | Sent as |
| --- | --- | --- | --- |
| `sendingToken` | Project sending token (`lm_…`) | `lettermint.emails.*` | `x-lettermint-token` header |
| `teamToken` | Team API token (`lm_team_…`) | Every other part (domains, messages, projects, …) | `Authorization: Bearer` header |

Pass one or both:

```ts
const lettermint = new Lettermint({
  sendingToken: process.env.LETTERMINT_PROJECT_TOKEN,
  teamToken: process.env.LETTERMINT_TEAM_TOKEN,
});
```

Each part uses its own token and never falls back to the other one. If the token a method needs is missing, it throws a `LettermintConfigError` that names the option (`domains.list needs `teamToken``), before any request. `lettermint.ping()` uses the team token when it is set, otherwise the sending token. `messages.reschedule()` and `messages.cancel()` accept either token in the same way.

You can also pass a single token as a string. The SDK chooses its type by the format: `lm_team_` followed by letters and digits is a team token, and `lm_` followed by letters and digits is a sending token. Any other value, such as an SSO verification token (`lm_sso_…`), throws a `LettermintConfigError`; pass `{ sendingToken }` or `{ teamToken }` explicitly in that case.

```ts
const lettermint = new Lettermint(process.env.LETTERMINT_TOKEN!);
// Other options go in the second argument:
const withTimeout = new Lettermint(process.env.LETTERMINT_TOKEN!, { timeout: 10_000 });
```

Other formats throw `LettermintConfigError`. Use `{ sendingToken }` or `{ teamToken }` for them. Error messages never contain the token.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `sendingToken` | | Project sending token. |
| `teamToken` | | Team API token. |
| `baseUrl` | `https://api.lettermint.co/v1` | API base URL. |
| `timeout` | `30000` | Request timeout in milliseconds. It covers the response headers and the body. |
| `fetch` | global `fetch` | A `fetch` implementation, for example for tests or a proxy. |

The client holds no per-request state, so create it once and share it.

## Sending email

### The email builder

`emails.compose()` returns an immutable builder. Every setter returns a new builder and leaves the original unchanged, so you can keep a base builder and reuse it, also across concurrent requests:

```ts
const welcome = lettermint.emails
  .compose()
  .from('Acme <hello@acme.com>')
  .subject('Welcome to Acme')
  .tags([{ name: 'campaign', value: 'welcome' }]);

await welcome.to('jane@example.com').html('<p>Hi Jane</p>').send();
await welcome.to('john@example.com').html('<p>Hi John</p>').send();
```

When you build an email over several statements, keep the returned builder:

```ts
let email = lettermint.emails.compose().from('hello@acme.com').to(user.email).subject('Your invoice');
if (user.accountant) email = email.cc(user.accountant);
await email.html(invoiceHtml).send();
```

Builder methods:

| Method | Description |
| --- | --- |
| `from(address)` | Sender, for example `Acme <hello@acme.com>`. |
| `to(...addresses)`, `cc(...)`, `bcc(...)`, `replyTo(...)` | Replace the recipient list. |
| `subject(text)` | Subject line. |
| `html(html \| null)`, `text(text \| null)` | Bodies. `null` removes one. |
| `headers(record)` | Custom email headers. |
| `metadata(record)` | Data stored with the message, not added as headers. |
| `tags([{ name, value }])`, `tag(name \| null)` | Name/value tags, and the legacy single tag. |
| `route(slug)` | The route to send through. |
| `scheduledAt(when \| null)` | Delivery time: a `Date`, ISO 8601, or English such as `tomorrow 9am`. |
| `settings({ track_opens, track_clicks, tls })` | Per-email settings that override the route. |
| `sandboxResult(result)` | The result a Sandbox project simulates. |
| `attach({ filename, content, contentType?, contentId? })` | Adds an attachment. |
| `send(options?)` | Sends a snapshot of the email. The builder can be sent again. |
| `build()` | Returns the message in API format. |

`emails.compose(message)` starts a builder from an existing message.

### Plain objects

`emails.send()` takes the message in the API's format (`reply_to`, `scheduled_at`, `sandbox_result`, …). It is typed as `EmailMessage`:

```ts
await lettermint.emails.send({
  from: 'Acme <hello@acme.com>',
  to: ['jane@example.com'],
  reply_to: ['support@acme.com'],
  subject: 'Your order has shipped',
  html,
  metadata: { order_id: '1234' },
});
```

### Batch sending

Send up to 500 emails in one request. The array may mix messages and builders:

```ts
const results = await lettermint.emails.sendBatch([
  { from: 'hello@acme.com', to: ['jane@example.com'], subject: 'Hi Jane', text: 'Hello' },
  welcome.to('john@example.com').html('<p>Hi John</p>'),
]);
```

### Idempotency

Pass an idempotency key to make retries safe. The API processes a key once, so a retry with the same key does not send the email again. The key applies only to the call it is passed to.

```ts
await lettermint.emails.send(message, { idempotencyKey: `order-${order.id}-confirmation` });
await builder.send({ idempotencyKey: 'welcome-jane' });
await lettermint.emails.sendBatch(messages, { idempotencyKey: 'newsletter-2026-10' });
```

The SDK never retries on its own.

### Scheduling

```ts
const result = await lettermint.emails
  .compose()
  .from('hello@acme.com')
  .to('jane@example.com')
  .subject('Your trial ends tomorrow')
  .text('…')
  .scheduledAt(new Date(Date.now() + 24 * 60 * 60 * 1000))
  .send();

if (result.status === 'scheduled') console.log(result.scheduled_at);

await lettermint.messages.reschedule(result.message_id, { scheduled_at: '2026-10-20T09:00:00Z' });
await lettermint.messages.cancel(result.message_id);
```

### Sandbox

In a Sandbox project, nothing is delivered. Choose the simulated result per email:

```ts
const result = await lettermint.emails.compose()
  .from('hello@acme.com')
  .to('jane@example.com')
  .subject('Test')
  .text('Test')
  .sandboxResult('hard_bounced')
  .send();

console.log(result.sandbox, result.sandbox_result); // true, "hard_bounced"
```

### Tags

`tags()` accepts up to 20 case-sensitive name/value tags (19 when the legacy `tag()` is also set). Names match `^[A-Za-z0-9_-]{1,32}$`, may not start with `__lettermint` and must be unique. Values match `^[A-Za-z0-9_-]{1,64}$`. The SDK checks this before the request and throws `LettermintValidationError`. Because builders are immutable, a rejected tag leaves the builder unchanged.

```ts
const email = base.tags([
  { name: 'campaign', value: 'welcome' },
  { name: 'plan', value: 'pro' },
]);
```

### Attachments

`content` is a base64 string, a `Uint8Array` (including a Node.js `Buffer`) or an `ArrayBuffer`. The SDK encodes bytes to base64.

```ts
import { readFile } from 'node:fs/promises';

await lettermint.emails
  .compose()
  .from('billing@acme.com')
  .to('jane@example.com')
  .subject('Your invoice')
  .html('<img src="cid:logo"> Your invoice is attached.')
  .attach({ filename: 'invoice.pdf', content: await readFile('invoice.pdf'), contentType: 'application/pdf' })
  .attach({ filename: 'logo.png', content: logoBase64, contentId: 'logo' })
  .send();
```

`lettermint.blockedFileTypes()` lists the extensions and MIME types the API rejects.

## Team API

With a team token, the client manages domains, messages, projects, routes, statistics, suppressions, the team and webhooks:

```ts
const lettermint = new Lettermint({ teamToken: process.env.LETTERMINT_TEAM_TOKEN });

const domain = await lettermint.domains.create({ domain: 'acme.com' });
await lettermint.domains.verifyDnsRecords(domain.id);

const project = await lettermint.projects.create({ name: 'Production' });
console.log(project.api_token); // the new project's sending token, shown once

const stats = await lettermint.stats.retrieve({ from: '2026-10-01', to: '2026-10-31' });
const html = await lettermint.messages.html('message-id');
```

| Property | Methods |
| --- | --- |
| `domains` | `list`, `iterate`, `create`, `retrieve`, `delete`, `verifyDnsRecords`, `verifyDnsRecord`, `updateProjects` |
| `messages` | `list`, `iterate`, `retrieve`, `events`, `iterateEvents`, `source`, `html`, `text`, `reschedule`, `cancel`, `process` |
| `projects` | `list`, `iterate`, `create`, `retrieve`, `update`, `delete`, `rotateToken` |
| `projects.reportForwarding` | `retrieve`, `update`, `delete`, `verify`, `resendCode` |
| `routes` | `list(projectId)`, `iterate(projectId)`, `create(projectId, …)`, `retrieve`, `update`, `delete`, `verifyInboundDomain` |
| `stats` | `retrieve` |
| `suppressions` | `list`, `iterate`, `create`, `delete` |
| `team` | `retrieve`, `update`, `usage`, `roles` |
| `team.members` | `list`, `iterate`, `retrieve`, `updateAssignment` |
| `webhooks` | `list`, `iterate`, `create`, `retrieve`, `update`, `delete`, `test`, `regenerateSecret` |
| `webhooks.deliveries` | `list(webhookId)`, `iterate(webhookId)`, `retrieve(webhookId, deliveryId)` |
| (root) | `ping`, `analytics`, `blockedFileTypes` |

### Query parameters and pagination

Query parameters are typed objects. The SDK sends them in the API's bracket syntax (`page[size]=30&filter[status]=verified&sort=-created_at`):

```ts
const page = await lettermint.domains.list({
  page: { size: 30 },
  filter: { status: 'verified' },
  sort: ['-created_at'],
});

console.log(page.data.length, page.next_cursor);
const next = await lettermint.domains.list({ page: { size: 30, cursor: page.next_cursor! } });
```

Every list has an `iterate()` method, an async generator that follows `next_cursor` until the last page:

```ts
for await (const message of lettermint.messages.iterate({ filter: { status: 'hard_bounced' } })) {
  console.log(message.id, message.subject);
}

for await (const delivery of lettermint.webhooks.deliveries.iterate(webhookId)) {
  // …
}
```

Stop early with `break`. The SDK requests the next page only when you get to it.

### Cancellation and timeouts

Every method takes an `options` argument last, with `signal` (an `AbortSignal`) and `timeout` (milliseconds, overrides the client's timeout):

```ts
const controller = new AbortController();
const page = lettermint.messages.list(undefined, { signal: controller.signal, timeout: 5_000 });
controller.abort(); // `page` rejects with the signal's reason
```

## Errors

Every error the SDK throws extends `LettermintError`:

| Class | When | Properties |
| --- | --- | --- |
| `ApiError` | Any 4xx or 5xx JSON (or empty) response | `status`, `code`, `message`, `details`, `body` |
| `AuthenticationError` | 401 | |
| `PermissionError` | 403 | |
| `NotFoundError` | 404 | |
| `ConflictError` | 409 | |
| `ValidationError` | 422 | `errors` (field errors) |
| `RateLimitError` | 429 | `retryAfter` (seconds) |
| `ServerError` | 5xx | |
| `TimeoutError` | No complete response within the timeout | `timeout` |
| `ConnectionError` | The request failed (DNS, TLS, refused, reset) | `cause` |
| `UnexpectedResponseError` | An empty or non-JSON body where JSON was expected, or an error page such as a proxy's HTML 502 | `status`, `bodyExcerpt` |
| `RedirectError` | A 3xx response. Redirects are never followed, so tokens never go elsewhere. | `status` |
| `LettermintConfigError` | A missing or unrecognised token, an invalid option or ID | |
| `LettermintValidationError` | The SDK rejected the request before sending it, such as invalid tags | `field` |
| `WebhookVerificationError` | A webhook delivery is not genuine | `reason` |

The `ApiError` subclasses extend `ApiError`. `code` and `message` come from the API's error body (`{ error: { code, message, details } }` or `{ message, errors }`).

```ts
import { ApiError, RateLimitError, TimeoutError, ValidationError } from 'lettermint';

try {
  await lettermint.emails.send(message, { idempotencyKey });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message, error.errors);
  } else if (error instanceof RateLimitError) {
    await sleep((error.retryAfter ?? 1) * 1000); // then retry with the same idempotencyKey
  } else if (error instanceof TimeoutError) {
    // The outcome is unknown. Retry with the same idempotencyKey.
  } else if (error instanceof ApiError) {
    console.error(error.status, error.code, error.message);
  } else {
    throw error;
  }
}
```

Errors never contain request headers or tokens, and `console.log(lettermint)` shows tokens as `[redacted]`.

## Webhooks

Verify each webhook delivery before you trust it. Use the webhook's signing secret (`whsec_…`), not an API token, and pass the **raw** request body: the signature covers the exact bytes, so parsing and re-serializing the JSON breaks it.

```ts
import { Webhook, WebhookVerificationError } from 'lettermint';

const webhook = new Webhook(process.env.LETTERMINT_WEBHOOK_SECRET!);

const event = await webhook.verify(rawBody, headers);
console.log(event.event, event.data);
```

`verify(rawBody, headers)` takes the body as a `string`, `Uint8Array` (including `Buffer`) or `ArrayBuffer`, and the headers as a Fetch `Headers` object or a Node.js header record. It requires `X-Lettermint-Signature` and `X-Lettermint-Delivery` (header names are case-insensitive), checks the HMAC-SHA256 signature with Web Crypto and a constant-time comparison, checks that the delivery timestamp equals the signed one and is within the tolerance, and returns the parsed payload. Otherwise it throws `WebhookVerificationError` with a `reason`.

### Express

```ts
import express from 'express';
import { Webhook, WebhookVerificationError } from 'lettermint';

const app = express();
const webhook = new Webhook(process.env.LETTERMINT_WEBHOOK_SECRET!);

// express.raw keeps the body as a Buffer. Do not use express.json() on this route.
app.post('/webhooks/lettermint', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = await webhook.verify(req.body, req.headers);
    // Handle event.event and event.data here.
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return res.sendStatus(400);
    throw error;
  }
});
```

### Next.js, Cloudflare Workers and other Fetch runtimes

```ts
// app/api/webhooks/lettermint/route.ts
import { Webhook, WebhookVerificationError } from 'lettermint';

const webhook = new Webhook(process.env.LETTERMINT_WEBHOOK_SECRET!);

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const event = await webhook.verify(rawBody, request.headers);
    // Handle event.event and event.data here.
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof WebhookVerificationError) return new Response('Invalid signature', { status: 400 });
    throw error;
  }
}
```

### Options and lower-level verification

The default tolerance is 300 seconds in either direction. Change it with `new Webhook(secret, { tolerance: 60 })`. `0` accepts only the current second; it does not disable the check. A valid signature does not prevent a repeated delivery within the tolerance, so track `event.id` if you must not process an event twice.

If the headers are not at hand, call `webhook.verifySignature(rawBody, signatureHeader, deliveryHeader?)`.

The payload is typed as `WebhookPayload`, with `event` as a `WebhookEvent` (`'message.delivered'`, `'message.hard_bounced'`, …). Unknown event names pass through as strings. Pass a type argument for `data`: `webhook.verify<{ message_id: string }>(rawBody, headers)`.

## TypeScript

Request and response types are generated from the Lettermint API specification and exported by name, for example `SendMailRequest`, `SendMailResponse`, `DomainData` and `ListDomainsResponse` (a `CursorPage<DomainListData>`). Enums are open (`'pending' | 'delivered' | … | (string & {})`), so values that the API adds later still type-check; give `switch` statements a `default` branch. The generated `ApiError` and `ValidationError` body types are exported as `ApiErrorBody` and `ValidationErrorBody`.

## Runtime support

- Node.js 20, 22 and 24 (tested in CI), Bun, Deno, Cloudflare Workers, Vercel Edge and other runtimes with `fetch` and Web Crypto.
- No dependencies and no Node.js-only APIs (`Buffer`, `node:*` modules, `process`). Pass `fetch` if your runtime has no global one.
- ESM and CommonJS builds with type declarations, not minified.
- The `User-Agent` header (`lettermint-node/<version>`) is set everywhere except in browsers. Do not use API tokens in browser code.

## Development

```bash
npm ci
npm run lint
npm run type-check
npm test
npm run build
npm run test:smoke   # packs the package and checks ESM, CJS and types from the tarball
```

`src/generated/` is generated by the private [SDK generator](https://github.com/lettermint/sdk-generator). Do not edit it by hand. With a checkout of the generator, `npm run generate` regenerates the files and `npm run generate:check` verifies them; set `LETTERMINT_SDK_GENERATOR` to the checkout (default `../sdk-generator`). Without the generator, as in CI, `generate:check` only verifies the generated headers.

## License

MIT

# Lettermint Node.js SDK

![NPM Version](https://img.shields.io/npm/v/lettermint)
![NPM Downloads](https://img.shields.io/npm/dm/lettermint)
[![Join our Discord server](https://img.shields.io/discord/1305510095588819035?logo=discord&logoColor=eee&label=Discord&labelColor=464ce5&color=0D0E28&cacheSeconds=43200)](https://lettermint.co/r/discord)


The official Node.js SDK for [Lettermint](https://lettermint.co).

## Installation

```bash
npm install lettermint
```

## Usage

### Sending Emails

Use a project sending token with `Lettermint.email(...)`. Sending tokens authenticate with the `x-lettermint-token` header.

```typescript
import { Lettermint } from "lettermint";

const email = Lettermint.email(process.env.LETTERMINT_SENDING_TOKEN!);
```

The SDK provides a fluent interface for sending emails:

```typescript
const response = await email
  .from('sender@acme.com')
  .to('recipient@acme.com')
  .subject('Hello from Lettermint')
  .text('This is a test email sent using the Lettermint Node.js SDK.')
  .send();

console.log(`Email sent with ID: ${response.message_id}`);
console.log(`Status: ${response.status}`);
```

#### Advanced Email Options

```typescript
const response = await email
  .from('John Doe <sender@acme.com>')
  .to('recipient1@acme.com', 'recipient2@acme.com')
  .cc('cc@acme.com')
  .bcc('bcc@acme.com')
  .replyTo('reply@acme.com')
  .subject('Hello from Lettermint')
  .html('<h1>Hello</h1><p>This is an HTML email.</p>')
  .text('This is a plain text version of the email.')
  .headers({
    'X-Custom-Header': 'Custom Value',
  })
  .attach('attachment.txt', Buffer.from('Hello World').toString('base64'))
  .attach('logo.png', Buffer.from('...').toString('base64'), 'logo') // Inline attachment
  .idempotencyKey('unique-id-123')
  .metadata({
    foo: 'bar',
  })
  .tag('campaign-123')
  .tags([
    { name: 'campaign', value: 'welcome' },
    { name: 'customer', value: 'new' },
  ])
  .send();
```

`tag()` remains available for the legacy single tag. `tags()` accepts up to 20
case-sensitive name/value tags, or 19 when `tag()` is also set.

The legacy constructor still works for sending-only usage:

```typescript
const lettermint = new Lettermint({ apiToken: 'your-sending-token' });
await lettermint.email.from('sender@acme.com').to('recipient@acme.com').subject('Hello').send();
```

### Batch Sending

```typescript
const response = await email.sendBatch([
  {
    from: 'sender@acme.com',
    to: ['recipient@acme.com'],
    subject: 'Hello from Lettermint',
    text: 'This is a batch email.',
  },
]);
```

### Team API

Use a team API token with `Lettermint.api(...)`. API tokens authenticate with `Authorization: Bearer ...` and are separate from project sending tokens.

```typescript
const api = Lettermint.api(process.env.LETTERMINT_API_TOKEN!);

const domains = await api.domains.list({ 'page[size]': '10' });
const project = await api.projects.create({
  name: 'Production',
  smtp_enabled: true,
});
const stats = await api.stats.retrieve({
  start: '2026-01-01',
  end: '2026-01-31',
});
const messageHtml = await api.messages.html('message-id');
```

Both API surfaces support `ping()`:

```typescript
await email.ping();
await api.ping();
```

### Webhook Verification

Use `Webhook` to verify incoming webhooks. Use the webhook signing secret, not an API token.
Pass the raw request body as a string or `Buffer`. Do not parse or change the body before verification.

```typescript
import { Webhook, WebhookVerificationError } from 'lettermint';

const webhook = new Webhook(process.env.LETTERMINT_WEBHOOK_SECRET!);

try {
  const payload = webhook.verifyHeaders(request.headers, rawBody);
  // Process the verified payload here.
} catch (error) {
  if (error instanceof WebhookVerificationError) {
    // Reject the request. Do not process its payload.
  } else {
    throw error;
  }
}
```

`verifyHeaders(headers, rawBody)` accepts Node.js request headers. It requires
`X-Lettermint-Signature` and `X-Lettermint-Delivery`. Header names are case-insensitive.
The delivery timestamp must match the timestamp in the signature.

You can also call `webhook.verify(rawBody, signatureHeader, deliveryTimestamp?)` directly.
Both methods check HMAC-SHA256 signatures with a constant-time comparison and return
the decoded JSON as `unknown`. Check the payload structure before use.

The default timestamp tolerance is 300 seconds in either direction. To change it,
use `new Webhook(secret, { tolerance: 60 })`. The tolerance must be a non-negative
integer in seconds. A value of `0` only accepts the current second; it does not
disable the timestamp check. A valid signature does not prevent repeat delivery
within this period. Track processed events if you must prevent duplicate work.

## API Reference

### Lettermint Class

The main entry points for the SDK.

```typescript
const email = Lettermint.email('your-sending-token', {
  baseUrl: 'https://api.lettermint.co/v1',
  timeout: 30000,
});

const api = Lettermint.api('your-api-token', {
  baseUrl: 'https://api.lettermint.co/v1',
  timeout: 30000,
});
```

### Email Endpoint

Methods for sending emails:

- `from(email: string)`: Set the sender email address
- `to(...emails: string[])`: Set one or more recipient email addresses
- `subject(subject: string)`: Set the email subject
- `html(html: string | null)`: Set the HTML body of the email
- `text(text: string | null)`: Set the plain text body of the email
- `cc(...emails: string[])`: Set one or more CC email addresses
- `bcc(...emails: string[])`: Set one or more BCC email addresses
- `replyTo(...emails: string[])`: Set one or more Reply-To email addresses
- `headers(headers: Record<string, string>)`: Set custom headers for the email
- `attach(filename: string, base64Content: string, content_id?: string)`: Attach a file to the email. Optional `content_id` for inline attachments.
- `route(route: string)`: Set the routing key for the email
- `idempotencyKey(key: string)`: Set an idempotency key to prevent duplicate email sends
- `metadata(metadata: Record<string, string>)`: Set metadata for the email
- `tag(tag: string)`: Set a tag for the email
- `send()`: Send the email and return a promise with the response
- `sendBatch(payload)`: Send multiple email payloads in one request
- `ping()`: Ping the Sending API and return the raw response body

### API Endpoint Groups

The full API client exposes `domains`, `messages`, `projects`, `routes`, `stats`, `suppressions`, `team`, and `webhooks`. Request and response types are exported from the package.

## License

MIT

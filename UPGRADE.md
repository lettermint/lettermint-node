# Upgrade To v2

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


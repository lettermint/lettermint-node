# Lettermint Node.js SDK

![NPM Version](https://img.shields.io/npm/v/lettermint)
![NPM Downloads](https://img.shields.io/npm/dm/lettermint)

The official Node.js SDK for [Lettermint](https://lettermint.co).

## Installation

```bash
npm install lettermint
```

## Usage

### Initialize the SDK

```typescript
import { Lettermint } from "lettermint";

const lettermint = new Lettermint({
    apiToken: "your-api-token"
});
```

### Sending Emails

The SDK provides a fluent interface for sending emails:

```typescript
const response = await lettermint.email
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
const response = await lettermint.email
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
  .send();
```

## API Reference

### Lettermint Class

The main entry point for the SDK.

```typescript
const lettermint = new Lettermint({
  apiToken: 'your-api-key',
  baseUrl: 'https://api.lettermint.co/v1', // Optional
  timeout: 30000, // Optional, in milliseconds
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
- `attach(filename: string, base64Content: string)`: Attach a file to the email
- `route(route: string)`: Set the routing key for the email
- `send()`: Send the email and return a promise with the response

## License

MIT
# Lettermint Node.js SDK

The official Node.js SDK for [Lettermint](https://lettermint.co), a powerful email delivery service.

## Installation

```bash
npm install lettermint
```

## Usage

### Initialize the SDK

```typescript
import Lettermint from 'lettermint';

const lettermint = new Lettermint({
  apiToken: 'your-api-key',
});
```

### Sending Emails

The SDK provides a fluent interface for sending emails:

```typescript
// Simple example
const response = await lettermint.email
  .from('sender@example.com')
  .to('recipient@example.com')
  .subject('Hello from Lettermint')
  .text('This is a test email sent using the Lettermint Node.js SDK.')
  .send();

console.log(`Email sent with ID: ${response.message_id}`);
console.log(`Status: ${response.status}`);
```

#### Advanced Email Options

```typescript
// More advanced example
const response = await lettermint.email
  .from('John Doe <sender@example.com>')
  .to('recipient1@example.com', 'recipient2@example.com')
  .cc('cc@example.com')
  .bcc('bcc@example.com')
  .replyTo('reply@example.com')
  .subject('Hello from Lettermint')
  .html('<h1>Hello</h1><p>This is an HTML email.</p>')
  .text('This is a plain text version of the email.')
  .headers({
    'X-Custom-Header': 'Custom Value',
  })
  .attach('attachment.txt', Buffer.from('Hello World').toString('base64'))
  .send();
```

### Managing Domains

```typescript
// List all domains
const domains = await lettermint.domain.list();

// Access domain information
domains.data.forEach(domain => {
  console.log(`Domain: ${domain.domain}`);
  console.log(`Status: ${domain.status}`);
  
  // Access DNS records if available
  if (domain.dns_records) {
    domain.dns_records.forEach(record => {
      console.log(`  Record: ${record.hostname} (${record.record_type})`);
      console.log(`  Content: ${record.content}`);
      console.log(`  Status: ${record.status}`);
    });
  }
});
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

### Domain Endpoint

Methods for managing domains:

- `list()`: List all domains

## Error Handling

The SDK throws standard JavaScript errors for HTTP and API failures. You can catch these errors using try/catch blocks:

```typescript
try {
  const response = await lettermint.email
    .from('sender@example.com')
    .to('recipient@example.com')
    .subject('Hello')
    .text('Hello World')
    .send();
} catch (error) {
  console.error('Failed to send email:', error);
}
```

## License

MIT
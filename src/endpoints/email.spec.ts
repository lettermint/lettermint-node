import { LettermintClient } from '../client';
import { EmailEndpoint } from './email';

jest.mock('../client');

describe('EmailEndpoint', () => {
  let client: jest.Mocked<LettermintClient>;
  let emailEndpoint: EmailEndpoint;

  beforeEach(() => {
    client = new LettermintClient({ apiToken: 'test-api-key' }) as jest.Mocked<LettermintClient>;

    emailEndpoint = new EmailEndpoint(client);

    client.post = jest.fn().mockResolvedValue({
      message_id: 'test-message-id',
      status: 'queued',
    });
  });

  it('should set the from address', () => {
    const result = emailEndpoint.from('test@example.com');

    // Verify fluent interface returns this
    expect(result).toBe(emailEndpoint);

    // Send the email to trigger the API call
    return emailEndpoint.send().then(() => {
      // Verify the payload contains the from address
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          from: 'test@example.com',
        })
      );
    });
  });

  it('should set the to addresses', () => {
    const result = emailEndpoint.to('recipient1@example.com', 'recipient2@example.com');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          to: ['recipient1@example.com', 'recipient2@example.com'],
        })
      );
    });
  });

  it('should set the subject', () => {
    const result = emailEndpoint.subject('Test Subject');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          subject: 'Test Subject',
        })
      );
    });
  });

  it('should set the HTML content', () => {
    const result = emailEndpoint.html('<p>Test HTML</p>');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          html: '<p>Test HTML</p>',
        })
      );
    });
  });

  it('should set the text content', () => {
    const result = emailEndpoint.text('Test text');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          text: 'Test text',
        })
      );
    });
  });

  it('should set the CC addresses', () => {
    const result = emailEndpoint.cc('cc1@example.com', 'cc2@example.com');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          cc: ['cc1@example.com', 'cc2@example.com'],
        })
      );
    });
  });

  it('should set the BCC addresses', () => {
    const result = emailEndpoint.bcc('bcc1@example.com', 'bcc2@example.com');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          bcc: ['bcc1@example.com', 'bcc2@example.com'],
        })
      );
    });
  });

  it('should set the reply-to addresses', () => {
    const result = emailEndpoint.replyTo('reply1@example.com', 'reply2@example.com');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          reply_to: ['reply1@example.com', 'reply2@example.com'],
        })
      );
    });
  });

  it('should set custom headers', () => {
    const headers = { 'X-Custom': 'Value', 'X-Another': 'Another Value' };
    const result = emailEndpoint.headers(headers);

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          headers,
        })
      );
    });
  });

  it('should add attachments', () => {
    const result = emailEndpoint.attach('test.txt', 'base64content');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.txt',
              content: 'base64content',
            },
          ],
        })
      );
    });
  });

  it('should set the route', () => {
    const result = emailEndpoint.route('test-route');

    expect(result).toBe(emailEndpoint);

    return emailEndpoint.send().then(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/send',
        expect.objectContaining({
          route: 'test-route',
        })
      );
    });
  });

  it('should send the email with all options', async () => {
    // Set up a complete email
    emailEndpoint
      .from('sender@example.com')
      .to('recipient@example.com')
      .subject('Test Subject')
      .html('<p>HTML Content</p>')
      .text('Text content')
      .cc('cc@example.com')
      .bcc('bcc@example.com')
      .replyTo('reply@example.com')
      .headers({ 'X-Custom': 'Value' })
      .attach('test.txt', 'base64content')
      .route('test-route');

    // Send the email
    const response = await emailEndpoint.send();

    // Verify the response
    expect(response).toEqual({
      message_id: 'test-message-id',
      status: 'queued',
    });

    // Verify the complete payload
    expect(client.post).toHaveBeenCalledWith('/send', {
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Test Subject',
      html: '<p>HTML Content</p>',
      text: 'Text content',
      cc: ['cc@example.com'],
      bcc: ['bcc@example.com'],
      reply_to: ['reply@example.com'],
      headers: { 'X-Custom': 'Value' },
      attachments: [
        {
          filename: 'test.txt',
          content: 'base64content',
        },
      ],
      route: 'test-route',
    }, undefined);
  });

  it('should set the idempotency key in the request headers', async () => {
    // Set up a basic email with an idempotency key
    emailEndpoint
      .from('sender@example.com')
      .to('recipient@example.com')
      .subject('Test Subject')
      .idempotencyKey('unique-id-123');

    // Send the email
    await emailEndpoint.send();

    // Verify the idempotency key is included in the request config
    expect(client.post).toHaveBeenCalledWith(
      '/send',
      expect.any(Object),
      {
        headers: {
          'Idempotency-Key': 'unique-id-123'
        }
      }
    );
  });
});

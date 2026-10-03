import { inspect } from 'node:util';
import { type EmailMessage, LettermintValidationError } from '../src';
import { SENDING_TOKEN, TEAM_TOKEN, client, delay, json, rejection, thrown } from './helpers';

const accepted = (id = 'message_1') => json(202, { message_id: id, status: 'pending' });

function sendingClient() {
  return client({}, (request) => accepted(`msg_${(request.body as EmailMessage).subject}`));
}

describe('emails.send', () => {
  it('posts exactly the message with the sending token', async () => {
    const { lettermint, requests } = sendingClient();
    const message: EmailMessage = {
      from: 'Acme <hello@acme.test>',
      to: ['jane@example.test'],
      subject: 'Welcome',
      html: '<p>Hi</p>',
    };
    await expect(lettermint.emails.send(message)).resolves.toEqual({
      message_id: 'msg_Welcome',
      status: 'pending',
    });
    const [request] = requests;
    expect(request.url).toBe('https://api.lettermint.co/v1/send');
    expect(request.method).toBe('POST');
    expect(request.body).toEqual(message);
    expect(request.headers['x-lettermint-token']).toBe(SENDING_TOKEN);
    expect(request.headers['Content-Type']).toBe('application/json');
    expect(request.headers.Accept).toBe('application/json');
    expect(request.headers['User-Agent']).toMatch(/^lettermint-node\/\d+\.\d+\.\d+/);
    expect(request.headers).not.toHaveProperty('Authorization');
    expect(request.headers).not.toHaveProperty('Idempotency-Key');
    expect(request.init.redirect).toBe('manual');
  });

  it('sends the idempotency key only for the call that sets it', async () => {
    const { lettermint, requests } = sendingClient();
    const message = { from: 'a@example.test', to: ['b@example.test'], subject: 'One' };
    await lettermint.emails.send(message, { idempotencyKey: 'order-123' });
    await lettermint.emails.send({ ...message, subject: 'Two' });
    expect(requests[0].headers['Idempotency-Key']).toBe('order-123');
    expect(requests[1].headers).not.toHaveProperty('Idempotency-Key');
  });

  it.each(['', 'line\nbreak', 42])('rejects the idempotency key %p before sending', async (key) => {
    const { lettermint, fetch } = sendingClient();
    const error = await rejection(
      lettermint.emails.send(
        { from: 'a@example.test', to: ['b@example.test'], subject: 'x' },
        { idempotencyKey: key as string }
      )
    );
    expect(error).toBeInstanceOf(LettermintValidationError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('snapshots the message when called, so later mutations do not leak in', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { lettermint, requests } = client({}, async () => {
      await gate;
      return accepted();
    });
    const message: EmailMessage = { from: 'a@example.test', to: ['b@example.test'], subject: 'x' };
    const pending = lettermint.emails.send(message);
    message.to.push('mallory@example.test');
    message.subject = 'changed';
    release();
    await pending;
    expect(requests[0].body).toEqual({
      from: 'a@example.test',
      to: ['b@example.test'],
      subject: 'x',
    });
  });

  it('base64-encodes binary attachment content', async () => {
    const { lettermint, requests } = sendingClient();
    await lettermint.emails.send({
      from: 'a@example.test',
      to: ['b@example.test'],
      subject: 'Files',
      attachments: [
        { filename: 'a.txt', content: new TextEncoder().encode('Hello World') },
        {
          filename: 'b.bin',
          content: new Uint8Array([0, 255, 128]).buffer,
          content_type: 'application/octet-stream',
        },
        { filename: 'c.txt', content: 'SGk=' },
      ],
    });
    expect((requests[0].body as EmailMessage).attachments).toEqual([
      { filename: 'a.txt', content: 'SGVsbG8gV29ybGQ=' },
      { filename: 'b.bin', content: 'AP+A', content_type: 'application/octet-stream' },
      { filename: 'c.txt', content: 'SGk=' },
    ]);
  });

  it('validates tags before any request', async () => {
    const { lettermint, fetch } = sendingClient();
    const error = await rejection(
      lettermint.emails.send({
        from: 'a@example.test',
        to: ['b@example.test'],
        subject: 'x',
        tags: [{ name: 'not valid!', value: 'x' }],
      })
    );
    expect(error).toBeInstanceOf(LettermintValidationError);
    expect(error.name).toBe('LettermintValidationError');
    expect((error as LettermintValidationError).field).toBe('tags');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a message that is not an object', async () => {
    const { lettermint } = sendingClient();
    await expect(lettermint.emails.send(null as never)).rejects.toThrow(LettermintValidationError);
  });
});

describe('emails.sendBatch', () => {
  it('posts the messages and builders as one batch with its own key', async () => {
    const { lettermint, requests } = client({}, () =>
      json(202, [
        { message_id: 'm1', status: 'pending' },
        { message_id: 'm2', status: 'scheduled', scheduled_at: '2026-10-05T09:00:00Z' },
      ])
    );
    const first = { from: 'a@example.test', to: ['b@example.test'], subject: 'One' };
    const second = lettermint.emails
      .compose()
      .from('a@example.test')
      .to('c@example.test')
      .subject('Two')
      .scheduledAt(new Date('2026-10-05T09:00:00Z'));
    const result = await lettermint.emails.sendBatch([first, second], {
      idempotencyKey: 'batch-1',
    });
    expect(result[1].status).toBe('scheduled');
    expect(requests[0].url).toBe('https://api.lettermint.co/v1/send/batch');
    expect(requests[0].body).toEqual([
      first,
      {
        from: 'a@example.test',
        to: ['c@example.test'],
        subject: 'Two',
        scheduled_at: '2026-10-05T09:00:00.000Z',
      },
    ]);
    expect(requests[0].headers['Idempotency-Key']).toBe('batch-1');

    await lettermint.emails.sendBatch([first]);
    expect(requests[1].headers).not.toHaveProperty('Idempotency-Key');
  });

  it('names the invalid message', async () => {
    const { lettermint, fetch } = sendingClient();
    const error = (await rejection(
      lettermint.emails.sendBatch([
        { from: 'a@example.test', to: ['b@example.test'], subject: 'ok' },
        { from: 'a@example.test', to: ['b@example.test'], subject: 'bad', tags: 'x' as never },
      ])
    )) as LettermintValidationError;
    expect(error.field).toBe('messages[1].tags');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('emails.compose', () => {
  it('sets every field', async () => {
    const { lettermint, requests } = sendingClient();
    await lettermint.emails
      .compose()
      .from('John Doe <john@example.test>')
      .to('to1@example.test', 'to2@example.test')
      .cc('cc@example.test')
      .bcc('bcc@example.test')
      .replyTo('reply@example.test')
      .subject('Everything')
      .html('<h1>Hello</h1>')
      .text('Hello')
      .headers({ 'X-Custom': 'Value' })
      .metadata({ foo: 'bar' })
      .tag('campaign-123')
      .tags([{ name: 'campaign', value: 'welcome' }])
      .route('transactional')
      .scheduledAt('tomorrow 9am')
      .settings({ track_opens: false, track_clicks: true, tls: 'enforced' })
      .sandboxResult('clicked')
      .attach({ filename: 'a.txt', content: 'SGk=' })
      .attach({
        filename: 'logo.png',
        content: 'iVBO',
        contentType: 'image/png',
        contentId: 'logo',
      })
      .send({ idempotencyKey: 'unique-id-123' });
    expect(requests[0].body).toEqual({
      from: 'John Doe <john@example.test>',
      to: ['to1@example.test', 'to2@example.test'],
      cc: ['cc@example.test'],
      bcc: ['bcc@example.test'],
      reply_to: ['reply@example.test'],
      subject: 'Everything',
      html: '<h1>Hello</h1>',
      text: 'Hello',
      headers: { 'X-Custom': 'Value' },
      metadata: { foo: 'bar' },
      tag: 'campaign-123',
      tags: [{ name: 'campaign', value: 'welcome' }],
      route: 'transactional',
      scheduled_at: 'tomorrow 9am',
      settings: { track_opens: false, track_clicks: true, tls: 'enforced' },
      sandbox_result: 'clicked',
      attachments: [
        { filename: 'a.txt', content: 'SGk=' },
        { filename: 'logo.png', content: 'iVBO', content_type: 'image/png', content_id: 'logo' },
      ],
    });
    expect(requests[0].headers['Idempotency-Key']).toBe('unique-id-123');
  });

  it('returns a new builder from every setter', () => {
    const { lettermint } = sendingClient();
    const base = lettermint.emails.compose();
    const next = base.from('a@example.test');
    expect(next).not.toBe(base);
    expect(base.build().from).toBe('');
    expect(next.build().from).toBe('a@example.test');
  });

  it('reuses a base builder for two recipients without mixing them', async () => {
    const { lettermint, requests } = sendingClient();
    const base = lettermint.emails.compose().from('Acme <hi@acme.test>').subject('Welcome');
    await base.to('jane@example.test').html('<p>Jane</p>').send();
    await base.to('john@example.test').html('<p>John</p>').send({ idempotencyKey: 'welcome-john' });
    expect(requests[0].body).toEqual({
      from: 'Acme <hi@acme.test>',
      to: ['jane@example.test'],
      subject: 'Welcome',
      html: '<p>Jane</p>',
    });
    expect(requests[0].headers).not.toHaveProperty('Idempotency-Key');
    expect(requests[1].body).toEqual({
      from: 'Acme <hi@acme.test>',
      to: ['john@example.test'],
      subject: 'Welcome',
      html: '<p>John</p>',
    });
    expect(requests[1].headers['Idempotency-Key']).toBe('welcome-john');
    expect(base.build()).toEqual({ from: 'Acme <hi@acme.test>', to: [], subject: 'Welcome' });
  });

  it('does not accumulate attachments across derived builders', () => {
    const { lettermint } = sendingClient();
    const base = lettermint.emails.compose().attach({ filename: 'a.txt', content: 'QQ==' });
    const one = base.attach({ filename: 'b.txt', content: 'Qg==' });
    const two = base.attach({ filename: 'c.txt', content: 'Qw==' });
    expect(base.build().attachments?.map((a) => a.filename)).toEqual(['a.txt']);
    expect(one.build().attachments?.map((a) => a.filename)).toEqual(['a.txt', 'b.txt']);
    expect(two.build().attachments?.map((a) => a.filename)).toEqual(['a.txt', 'c.txt']);
  });

  it('copies arrays and maps passed to setters', () => {
    const { lettermint } = sendingClient();
    const recipients = ['a@example.test'];
    const headers: Record<string, string> = { 'X-A': '1' };
    const tags = [{ name: 'n', value: 'v' }];
    const builder = lettermint.emails
      .compose()
      .to(...recipients)
      .headers(headers)
      .tags(tags);
    recipients.push('b@example.test');
    headers['X-B'] = '2';
    tags[0].value = 'changed';
    expect(builder.build()).toMatchObject({
      to: ['a@example.test'],
      headers: { 'X-A': '1' },
      tags: [{ name: 'n', value: 'v' }],
    });
    const built = builder.build();
    built.to.push('c@example.test');
    expect(builder.build().to).toEqual(['a@example.test']);
  });

  it('keeps the base builder unchanged when a setter throws', async () => {
    const { lettermint, requests } = sendingClient();
    const base = lettermint.emails
      .compose()
      .from('a@example.test')
      .to('b@example.test')
      .subject('Base')
      .tags([{ name: 'ok', value: 'yes' }]);
    const before = base.build();
    const error = thrown(() => base.tags([{ name: 'not a valid tag name!', value: 'x' }]));
    expect(error).toBeInstanceOf(LettermintValidationError);
    expect(base.build()).toEqual(before);
    await base.send();
    expect(requests[0].body).toEqual(before);
  });

  it('removes html, text, tag and scheduled time with null', () => {
    const { lettermint } = sendingClient();
    const builder = lettermint.emails
      .compose()
      .html('<p>x</p>')
      .text('x')
      .tag('t')
      .scheduledAt('tomorrow')
      .html(null)
      .text(null)
      .tag(null)
      .scheduledAt(null);
    expect(builder.build()).toEqual({ from: '', to: [], subject: '' });
  });

  it('starts from a message', () => {
    const { lettermint } = sendingClient();
    const message = { from: 'a@example.test', to: ['b@example.test'], subject: 'Hi' };
    const builder = lettermint.emails.compose(message);
    message.to.push('c@example.test');
    expect(builder.to('d@example.test').build()).toEqual({
      from: 'a@example.test',
      to: ['d@example.test'],
      subject: 'Hi',
    });
    expect(builder.build().to).toEqual(['b@example.test']);
  });

  it('encodes binary attachments without Buffer and copies the bytes', () => {
    const { lettermint } = sendingClient();
    const bytes = new TextEncoder().encode('Hello World');
    const builder = lettermint.emails.compose().attach({ filename: 'a.txt', content: bytes });
    bytes[0] = 0;
    expect(builder.build().attachments).toEqual([
      { filename: 'a.txt', content: 'SGVsbG8gV29ybGQ=' },
    ]);
    const large = new Uint8Array(100_000).map((_, i) => i % 256);
    const encoded = lettermint.emails.compose().attach({ filename: 'big', content: large }).build();
    expect(encoded.attachments?.[0].content).toBe(Buffer.from(large).toString('base64'));
  });

  it('rejects the positional v2 attach() signature', () => {
    const { lettermint } = sendingClient();
    const error = thrown(() =>
      (lettermint.emails.compose().attach as (...args: unknown[]) => unknown)('a.txt', 'SGk=')
    );
    expect(error).toBeInstanceOf(LettermintValidationError);
    expect(error.message).toContain('attach() takes an object');
  });

  it('serializes and inspects the message without credentials', () => {
    const { lettermint } = sendingClient();
    const builder = lettermint.emails.compose().from('a@example.test').subject('Hi');
    expect(JSON.parse(JSON.stringify(builder))).toEqual({
      from: 'a@example.test',
      to: [],
      subject: 'Hi',
    });
    const rendered = inspect(builder, { depth: Number.POSITIVE_INFINITY });
    expect(rendered).toContain('EmailBuilder');
    expect(rendered).toContain('a@example.test');
    expect(rendered).not.toContain(SENDING_TOKEN);
    expect(rendered).not.toContain(TEAM_TOKEN);
  });
});

describe('message tags', () => {
  const maxTags = Array.from({ length: 20 }, (_, i) => ({ name: `tag${i}`, value: 'v' }));

  it.each([
    [
      [
        { name: 'duplicate', value: 'one' },
        { name: 'duplicate', value: 'two' },
      ],
      'unique',
    ],
    [[{ name: '__LETTERMint_internal', value: 'one' }], '__lettermint'],
    [[{ name: 'invalid name', value: 'one' }], 'names must match'],
    [[{ name: 'x'.repeat(33), value: 'one' }], 'names must match'],
    [[{ name: 'valid', value: 'invalid value' }], 'values must match'],
    [[{ name: 'valid', value: 'x'.repeat(65) }], 'values must match'],
    [[{ name: 'valid' }], '{ name, value }'],
    [[...maxTags, { name: 'one-more', value: 'v' }], 'No more than 20'],
  ])('rejects invalid tags %#', (tags, message) => {
    const { lettermint } = sendingClient();
    const error = thrown(() => lettermint.emails.compose().tags(tags as never));
    expect(error).toBeInstanceOf(LettermintValidationError);
    expect(error.message).toContain(message);
  });

  it('allows 20 tags, or 19 with a legacy tag', () => {
    const { lettermint } = sendingClient();
    const builder = lettermint.emails.compose().tags(maxTags);
    expect(() => builder.tag('legacy')).toThrow('A legacy tag and no more than 19');
    expect(() => lettermint.emails.compose().tag('legacy').tags(maxTags)).toThrow(
      'A legacy tag and no more than 19'
    );
    expect(
      lettermint.emails.compose().tag('legacy').tags(maxTags.slice(1)).build().tags
    ).toHaveLength(19);
  });

  it('accepts case-sensitive duplicates', () => {
    const { lettermint } = sendingClient();
    const tags = [
      { name: 'Campaign', value: 'a' },
      { name: 'campaign', value: 'b' },
    ];
    expect(lettermint.emails.compose().tags(tags).build().tags).toEqual(tags);
  });
});

describe('concurrency', () => {
  it('keeps two emails composed and sent concurrently on one client separate', async () => {
    // The fake API answers the first request last, so both requests are in flight together.
    const { lettermint, requests } = client({}, async (request) => {
      const subject = (request.body as EmailMessage).subject;
      await delay(subject === 'A' ? 30 : 5);
      return accepted(`msg_${subject}`);
    });
    const compose = async (label: 'A' | 'B', recipients: string[]) => {
      let builder = lettermint.emails.compose();
      builder = builder.from(`${label} <${label.toLowerCase()}@example.test>`);
      await delay(1);
      builder = builder.to(...recipients);
      await delay(1);
      builder = builder.subject(label).html(`<p>${label}</p>`);
      await delay(1);
      builder = builder.attach({ filename: `${label}.txt`, content: 'SGk=' });
      return builder.send({ idempotencyKey: `key-${label}` });
    };
    const direct = (label: 'C') =>
      lettermint.emails.send(
        { from: 'c@example.test', to: ['c@example.test'], subject: label },
        { idempotencyKey: 'key-C' }
      );
    const results = await Promise.all([
      compose('A', ['a1@example.test', 'a2@example.test']),
      compose('B', ['b1@example.test']),
      direct('C'),
    ]);
    expect(results.map((result) => result.message_id)).toEqual(['msg_A', 'msg_B', 'msg_C']);
    const bySubject = Object.fromEntries(
      requests.map((request) => [(request.body as EmailMessage).subject, request])
    );
    expect(bySubject.A.body).toEqual({
      from: 'A <a@example.test>',
      to: ['a1@example.test', 'a2@example.test'],
      subject: 'A',
      html: '<p>A</p>',
      attachments: [{ filename: 'A.txt', content: 'SGk=' }],
    });
    expect(bySubject.B.body).toEqual({
      from: 'B <b@example.test>',
      to: ['b1@example.test'],
      subject: 'B',
      html: '<p>B</p>',
      attachments: [{ filename: 'B.txt', content: 'SGk=' }],
    });
    expect(bySubject.A.headers['Idempotency-Key']).toBe('key-A');
    expect(bySubject.B.headers['Idempotency-Key']).toBe('key-B');
    expect(bySubject.C.headers['Idempotency-Key']).toBe('key-C');
  });

  it('leaves nothing behind after a failed request', async () => {
    const { lettermint, requests } = client({}, (_, index) =>
      index === 0 ? json(500, { message: 'Server Error' }) : accepted()
    );
    await expect(
      lettermint.emails
        .compose()
        .from('a@example.test')
        .to('b@example.test')
        .cc('cc@example.test')
        .subject('A')
        .send({ idempotencyKey: 'key-A' })
    ).rejects.toMatchObject({ name: 'ServerError', status: 500 });
    await lettermint.emails
      .compose()
      .from('c@example.test')
      .to('d@example.test')
      .subject('C')
      .send();
    expect(requests[1].body).toEqual({
      from: 'c@example.test',
      to: ['d@example.test'],
      subject: 'C',
    });
    expect(requests[1].headers).not.toHaveProperty('Idempotency-Key');
  });
});

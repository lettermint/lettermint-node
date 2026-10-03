import { runInNewContext } from 'node:vm';
import { bytesToBase64, isBinary, toBytes } from '../src/encoding';
import { serializeQuery, withQueryParam } from '../src/query';

describe('bytesToBase64', () => {
  const sample = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7) % 256);

  it('matches Node for every input type', () => {
    const expected = Buffer.from(sample).toString('base64');
    expect(bytesToBase64(sample)).toBe(expected);
    expect(bytesToBase64(sample.buffer)).toBe(expected);
    expect(bytesToBase64(new DataView(sample.buffer))).toBe(expected);
    expect(bytesToBase64(sample.subarray(1, 4))).toBe(
      Buffer.from(sample.subarray(1, 4)).toString('base64')
    );
    expect(bytesToBase64(Buffer.from('Hello'))).toBe('SGVsbG8=');
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('works without the native Uint8Array.prototype.toBase64', () => {
    const proto = Uint8Array.prototype as unknown as Record<string, unknown>;
    const native = proto.toBase64;
    // biome-ignore lint/performance/noDelete: the property must be absent, not undefined
    delete proto.toBase64;
    try {
      expect(bytesToBase64(sample)).toBe(Buffer.from(sample).toString('base64'));
    } finally {
      if (native) proto.toBase64 = native;
    }
  });

  it('accepts binary values from another realm', () => {
    const foreign = runInNewContext('new Uint8Array([104, 105]).buffer');
    expect(isBinary(foreign)).toBe(true);
    expect(toBytes(foreign)).toEqual(new Uint8Array([104, 105]));
    expect(isBinary('text')).toBe(false);
    expect(isBinary({ length: 1 })).toBe(false);
  });
});

describe('serializeQuery', () => {
  it('handles scalars, dates, nesting and empty values', () => {
    expect(serializeQuery(undefined)).toBe('');
    expect(serializeQuery({})).toBe('');
    expect(
      decodeURIComponent(
        serializeQuery({
          a: 1,
          b: true,
          c: false,
          d: null,
          e: undefined,
          f: [],
          g: ['x', 'y'],
          h: { i: 'j', k: { l: 'm' } },
          n: new Date('2026-01-02T03:04:05Z'),
          'page[size]': 5,
        })
      )
    ).toBe('a=1&b=1&c=0&g=x,y&h[i]=j&h[k][l]=m&n=2026-01-02T03:04:05.000Z&page[size]=5');
  });

  it('encodes reserved characters', () => {
    expect(serializeQuery({ filter: { search: 'a&b=c #d' } })).toBe(
      'filter%5Bsearch%5D=a%26b%3Dc+%23d'
    );
  });
});

describe('withQueryParam', () => {
  it('sets top-level and bracketed parameters without changing the input', () => {
    const query = { page: { size: 2 }, 'page[cursor]': 'old' };
    expect(withQueryParam(query, 'page[cursor]', 'next')).toEqual({
      page: { size: 2, cursor: 'next' },
    });
    expect(withQueryParam(undefined, 'cursor', 'c')).toEqual({ cursor: 'c' });
    expect(query).toEqual({ page: { size: 2 }, 'page[cursor]': 'old' });
  });
});

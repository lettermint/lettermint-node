type Simplify<T> = { [K in keyof T]: T[K] } & {};

type BracketKey = `${string}[${string}`;
type Prefix<K> = K extends `${infer P}[${string}]` ? P : never;
type Group<Q, P extends string> = {
  [K in keyof Q as K extends `${P}[${infer S}]`
    ? S extends `${string}[${string}` | `${string}]${string}`
      ? never
      : S
    : never]?: Q[K];
};
type Merge<A, B> = Omit<A, keyof B> & {
  [K in keyof B]?: B[K] | (K extends keyof A ? A[K] : never);
};
type GroupOf<Q, P extends string> = P extends keyof Q
  ? Simplify<Merge<Group<Q, P>, NonNullable<Q[P]>>>
  : Simplify<Group<Q, P>>;

/**
 * Turns a generated query type, keyed by wire names such as `'page[size]'` and
 * `'filter[status]'`, into nested objects: `{ page: { size }, filter: { status } }`.
 * Keys without brackets (`sort`, `include`, `cursor`) stay as they are.
 */
export type NestedQuery<Q> = Simplify<
  {
    [K in keyof Q as K extends BracketKey ? never : K extends Prefix<keyof Q> ? never : K]: Q[K];
  } & {
    [P in Prefix<keyof Q> & string]?: GroupOf<Q, P>;
  }
>;

function scalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isScalar(value: unknown): boolean {
  return value === null || value instanceof Date || typeof value !== 'object';
}

function append(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    if (value.every(isScalar)) {
      const items = value.filter((item) => item !== undefined && item !== null).map(scalar);
      if (items.length > 0) params.append(key, items.join(','));
      return;
    }
    value.forEach((item, index) => append(params, `${key}[${index}]`, item));
    return;
  }
  if (isScalar(value)) {
    params.append(key, scalar(value));
    return;
  }
  for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
    append(params, `${key}[${name}]`, item);
  }
}

/**
 * Serializes a nested query object to the API's bracket syntax:
 * `{ page: { size: 10 }, filter: { status: 'verified' }, sort: ['-created_at'] }`
 * becomes `page[size]=10&filter[status]=verified&sort=-created_at`.
 * Arrays of scalars are comma-separated, arrays of objects are indexed,
 * booleans are `1`/`0`, and `undefined`/`null` values are left out.
 */
export function serializeQuery(query: object | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) append(params, key, value);
  return params.toString();
}

/** Returns a copy of `query` with the parameter at wire name `name` (`cursor` or `page[cursor]`) set. */
export function withQueryParam(query: object | undefined, name: string, value: string): object {
  const match = /^([^[\]]+)\[([^[\]]+)\]$/.exec(name);
  const base = { ...(query ?? {}) } as Record<string, unknown>;
  if (!match) {
    base[name] = value;
    return base;
  }
  const [, group, key] = match;
  delete base[name];
  const current = base[group];
  base[group] = { ...(current && typeof current === 'object' ? current : {}), [key]: value };
  return base;
}

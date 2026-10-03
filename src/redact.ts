/** Node's `util.inspect` hook, registered by name so that no `node:util` import is needed. */
export const inspectCustom: unique symbol = Symbol.for('nodejs.util.inspect.custom');

export const REDACTED = '[redacted]';

type Inspect = (value: unknown, options?: unknown) => string;

/**
 * Renders `name { ...view }` for `util.inspect`. `view` must only hold values
 * that are safe to log.
 */
export function renderInspect(
  name: string,
  view: object,
  options: unknown,
  inspect: unknown
): string {
  if (typeof inspect === 'function') {
    return `${name} ${(inspect as Inspect)(view, options)}`;
  }
  return `${name} ${JSON.stringify(view)}`;
}

import type { OperationKey, OperationResponse } from '../generated/operations';
import { inspectCustom, renderInspect } from '../redact';
import type { CallArgs, Transport } from '../transport';

/**
 * Base of the Team API sub-clients. The transport (and with it the tokens)
 * lives in a private field; inspecting or serializing a sub-client shows no
 * credentials.
 */
export abstract class ApiResource {
  readonly #transport: Transport;
  readonly #name: string;

  /** @internal */
  constructor(transport: Transport, name: string) {
    this.#transport = transport;
    this.#name = name;
  }

  /** @internal */
  protected request<K extends OperationKey>(
    key: K,
    args: CallArgs<K>
  ): Promise<OperationResponse<K>> {
    return this.#transport.call(key, args);
  }

  /** @internal */
  protected paginate<T, K extends OperationKey>(
    key: K,
    args: CallArgs<K>
  ): AsyncGenerator<T, void, undefined> {
    return this.#transport.paginate<T, K>(key, args);
  }

  toJSON(): Record<string, never> {
    return {};
  }

  [inspectCustom](_depth: number, options: unknown, inspect: unknown): string {
    return renderInspect(this.#name, {}, options, inspect);
  }
}

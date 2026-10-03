/** Binary input accepted for attachments and webhook bodies. */
export type BinaryInput = Uint8Array | ArrayBuffer | ArrayBufferView;

// Tag checks instead of `instanceof`, so values from another realm (iframes, vm contexts) work too.
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

export function isBinary(value: unknown): value is BinaryInput {
  return isArrayBuffer(value) || ArrayBuffer.isView(value);
}

export function toBytes(value: BinaryInput): Uint8Array {
  if (isArrayBuffer(value)) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/** Base64-encodes bytes with web-standard APIs only, so it runs in every runtime. */
export function bytesToBase64(input: BinaryInput): string {
  const bytes = toBytes(input);
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64;
  if (typeof native === 'function') return native.call(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

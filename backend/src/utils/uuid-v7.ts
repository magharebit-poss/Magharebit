/**
 * UUIDv7 generator — local copy for the backend runtime.
 *
 * The workspace package @greengo/local-db/src/uuid-v7 is TypeScript source;
 * tsx/Node ESM cannot resolve named exports from a TS source path at startup.
 * This file is a verbatim copy of the relevant parts kept in sync manually.
 * Source of truth: packages/local-db/src/uuid-v7.ts
 */

const UUIDV7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let lastTimestamp = 0;
let sequence = 0;

export function generateUUIDv7(): string {
  let timestamp = Date.now();

  if (timestamp === lastTimestamp) {
    sequence++;
    if (sequence > 4095) {
      timestamp = lastTimestamp + 1;
      while (Date.now() <= lastTimestamp) {
        // busy-wait until real clock catches up (rarely needed)
      }
      timestamp = Date.now();
      sequence = 0;
    }
  } else if (timestamp > lastTimestamp) {
    sequence = 0;
  } else {
    // Clock went backwards — use last timestamp + increment.
    timestamp = lastTimestamp;
    sequence++;
    if (sequence > 4095) {
      timestamp++;
      sequence = 0;
    }
  }

  lastTimestamp = timestamp;

  // 48-bit timestamp in ms
  const timeBits = timestamp.toString(16).padStart(12, '0');
  // version (4 bits = 0x7) + seq high (12 bits)
  const seqHigh = (0x7000 | (sequence & 0x0fff)).toString(16).padStart(4, '0');
  // variant (2 bits = 0b10) + 62 random bits
  const randA = ((Math.random() * 0x3fff) | 0x8000).toString(16).padStart(4, '0');
  const randB = randomHex(12);

  return `${timeBits.slice(0, 8)}-${timeBits.slice(8, 12)}-${seqHigh}-${randA}-${randB}`;
}

export function isUUIDv7(value: string): boolean {
  return UUIDV7_REGEX.test(value);
}

export function extractTimestamp(uuid: string): Date {
  if (!isUUIDv7(uuid)) {
    throw new Error(`Invalid UUIDv7: ${uuid}`);
  }
  const hex = uuid.replace(/-/g, '');
  return new Date(parseInt(hex.slice(0, 12), 16));
}

function randomHex(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

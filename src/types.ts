// Thanks to: https://branded-type-generator.pages.dev

// Idempotency Fingerprint

const IdempotencyFingerprintBrand = Symbol();

export type IdempotencyFingerprint = string & {
  [IdempotencyFingerprintBrand]: unknown;
};

export function createIdempotencyFingerprint(
  p: string,
): IdempotencyFingerprint {
  return p as IdempotencyFingerprint;
}

// Idempotent Storage Key

const IdempotentStorageKeyBrand = Symbol();

export type IdempotentStorageKey = string & {
  [IdempotentStorageKeyBrand]: unknown;
};

export function createIdempotentStorageKey(p: string): IdempotentStorageKey {
  return p as IdempotentStorageKey;
}

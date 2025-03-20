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

// Idempotent Cache Lookup Key

const IdempotentCacheLookupKeyBrand = Symbol();

export type IdempotentCacheLookupKey = string & {
  [IdempotentCacheLookupKeyBrand]: unknown;
};

export function createIdempotentCacheLookupKey(
  p: string,
): IdempotentCacheLookupKey {
  return p as IdempotentCacheLookupKey;
}

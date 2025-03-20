const IdempotencyFingerprintBrand = Symbol();

export type IdempotencyFingerprint = string & {
  [IdempotencyFingerprintBrand]: unknown;
};

export function createIdempotencyFingerprint(
  p: string,
): IdempotencyFingerprint {
  return p as IdempotencyFingerprint;
}

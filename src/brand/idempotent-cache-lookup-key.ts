const IdempotentCacheLookupKeyBrand = Symbol();

export type IdempotentCacheLookupKey = string & {
  [IdempotentCacheLookupKeyBrand]: unknown;
};

export function createIdempotentCacheLookupKey(
  p: string,
): IdempotentCacheLookupKey {
  return p as IdempotentCacheLookupKey;
}

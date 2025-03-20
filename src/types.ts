import type { IdempotencyFingerprint } from "./brand/idempotency-fingerprint";
import type { IdempotentCacheLookupKey } from "./brand/idempotent-cache-lookup-key";
import type { SerializedResponse } from "./utils/response";

type IdempotentRequestBase = {
  /** Cache lookup key */
  cacheLookupKey: IdempotentCacheLookupKey;

  createdAt: Date;

  updatedAt: Date;

  /** Request fingerprint */
  fingerprint: IdempotencyFingerprint;

  /** Stored response
   * (null until server completes processing request)
   */
  response: SerializedResponse | null;
};

export type StoredIdempotentRequest =
  | LockedIdempotentRequest
  | NonLockedIdempotentRequest;

export type NonLockedIdempotentRequest = IdempotentRequestBase & {
  /**
   * Time when the request was locked for processing
   *
   * This is used to prevent race conditions when multiple requests are
   * trying to process the same request concurrently.
   */
  lockedAt: null;
};

export type LockedIdempotentRequest = IdempotentRequestBase & {
  /**
   * Time when the request was locked for processing
   *
   * This is used to prevent race conditions when multiple requests are
   * trying to process the same request concurrently.
   */
  lockedAt: Date;
};

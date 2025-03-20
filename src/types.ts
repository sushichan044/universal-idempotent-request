import type { IdempotentCacheLookupKey } from "./brand/idempotent-cache-lookup-key";
import type { SerializedResponse } from "./utils/response";

type IdempotentRequestBase = {
  /** Cache lookup key */
  cacheLookupKey: IdempotentCacheLookupKey;

  /** Time when the request was first processed */
  createdAt: Date;

  /** Request fingerprint */
  fingerprint: string;

  /** Stored response (null on initial execution) */
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

import type { IdempotentStorageKey } from "./brand";
import type { RequestIdentifier } from "./identifier";
import type { SerializedResponse } from "./utils/response";

type IdempotentRequestBase = RequestIdentifier & {
  /**
   * Storage key
   *
   * This is used to retrieve the request from the storage.
   */
  storageKey: IdempotentStorageKey;

  /**
   * Stored response
   * (null until server completes processing request)
   */
  response: SerializedResponse | null;
};

export type StoredIdempotentRequest =
  | LockedIdempotentRequest
  | NonLockedIdempotentRequest;

export type NonLockedIdempotentRequest = Readonly<
  IdempotentRequestBase & {
    /**
     * Time when the request was locked for processing
     *
     * This is used to prevent race conditions when multiple requests are
     * trying to process the same request concurrently.
     */
    lockedAt: null;
  }
>;

export type LockedIdempotentRequest = Readonly<
  IdempotentRequestBase & {
    /**
     * Time when the request was locked for processing
     *
     * This is used to prevent race conditions when multiple requests are
     * trying to process the same request concurrently.
     */
    lockedAt: Date;
  }
>;

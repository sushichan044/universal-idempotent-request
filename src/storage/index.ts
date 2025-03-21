import type { IdempotentCacheLookupKey } from "../brand";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";
import type { MaybePromise } from "../utils/types";

export type NewIdempotentRequest = Pick<
  NonLockedIdempotentRequest,
  "cacheLookupKey" | "fingerprint"
>;

/**
 * Storage for idempotent request records.
 *
 * You should implement features like TTL, cleanup, etc. at this layer.
 */
export interface IdempotentRequestCacheStorage {
  /**
   * Create a new request
   * @param request - The request information to store
   */
  create(
    request: NewIdempotentRequest,
  ): MaybePromise<NonLockedIdempotentRequest>;

  /**
   * Retrieve a stored request associated with the given key.
   *
   * @param lookupKey - Cache lookup key
   * @returns The stored request information. It should be null if the request is not found.
   */
  get(
    lookupKey: IdempotentCacheLookupKey,
  ): MaybePromise<StoredIdempotentRequest | null>;

  /**
   * Lock a request to begin processing
   * @param nonLockedRequest - Non-locked stored request
   */
  lock(
    nonLockedRequest: NonLockedIdempotentRequest,
  ): MaybePromise<LockedIdempotentRequest>;

  /**
   * Unlock a request and store the response
   * @param lockedRequest - Locked request
   * @param response - The response to store
   */
  setResponse(
    lockedRequest: LockedIdempotentRequest,
    response: SerializedResponse,
  ): MaybePromise<void>;

  /**
   * Unlock a request
   * @param lockedRequest - Locked request
   */
  unlock(
    lockedRequest: LockedIdempotentRequest,
  ): MaybePromise<NonLockedIdempotentRequest>;
}

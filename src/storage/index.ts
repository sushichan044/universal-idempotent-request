import type { IdempotentStorageKey } from "../brand";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";
import type { MaybePromise } from "../utils/types";

export type NewIdempotentRequest = Pick<
  NonLockedIdempotentRequest,
  "fingerprint" | "storageKey"
>;

/**
 * Storage for idempotent request records.
 *
 * You should implement features like TTL, cleanup, etc. at this layer.
 */
export interface IdempotentRequestStorage {
  /**
   * Store a new request.
   *
   * @param request
   * The request information to store.
   * @returns
   * The stored, non-locked request information.
   */
  create(
    request: NewIdempotentRequest,
  ): MaybePromise<NonLockedIdempotentRequest>;

  /**
   * Retrieve a stored request associated with the given key.
   *
   * @param storageKey
   * The key to retrieve the request from the storage.
   * @returns
   * The stored request information. It should be `null` if the request is not found.
   */
  get(
    storageKey: IdempotentStorageKey,
  ): MaybePromise<StoredIdempotentRequest | null>;

  /**
   * Lock a request to begin processing
   *
   * @param nonLockedRequest
   * The non-locked stored request.
   * @returns
   * The locked request information.
   */
  lock(
    nonLockedRequest: NonLockedIdempotentRequest,
  ): MaybePromise<LockedIdempotentRequest>;

  /**
   * Unlock a request and store the response.
   *
   * @param lockedRequest
   * The locked request.
   * @param response
   * The response to store.
   */
  setResponseAndUnlock(
    lockedRequest: LockedIdempotentRequest,
    response: SerializedResponse,
  ): MaybePromise<void>;
}

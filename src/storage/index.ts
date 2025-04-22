import type { IdempotentStorageKey } from "../brand";
import type { RequestIdentifier } from "../identifier";
import type { SerializedResponse } from "../utils/response";
import type { MaybePromise } from "../utils/types";

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

export type NewIdempotentRequest = Pick<
  NonLockedIdempotentRequest,
  | "fingerprint"
  | "idempotencyKey"
  | "requestMethod"
  | "requestPath"
  | "storageKey"
>;

export type FindOrCreateStorageResult =
  | {
      created: false;
      storedRequest: StoredIdempotentRequest;
    }
  | {
      created: true;
      storedRequest: NonLockedIdempotentRequest;
    };

/**
 * Storage for idempotent request records.
 *
 * You should implement features like TTL, cleanup, etc. at this layer.
 */
export interface IdempotentRequestStorage {
  /**
   * Find or create a new request.
   *
   * @param request
   * The request information to store.
   * @returns
   * The stored, non-locked request information.
   */
  findOrCreate(
    request: NewIdempotentRequest,
  ): MaybePromise<FindOrCreateStorageResult>;

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

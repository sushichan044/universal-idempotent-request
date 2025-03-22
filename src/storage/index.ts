import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";
import type { MaybePromise } from "../utils/types";

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

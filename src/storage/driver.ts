import type { StorageKey } from "../brand";
import type { IdempotentRequest } from "../idempotent-request";
import type { MaybePromise } from "../utils/types";

/**
 * Storage for idempotent request records.
 *
 * You should implement features like TTL, cleanup, etc. at this layer.
 */
export interface IdempotentRequestStorageDriver {
  /**
   * Get a stored request.
   *
   * @param storageKey
   * The storage key of the request.
   * @returns
   * Stored request or `null` if the request is not found.
   */
  get(storageKey: StorageKey): MaybePromise<IdempotentRequest | null>;

  /**
   * Save a request.
   *
   * @param request
   * The request to save.
   */
  save(request: IdempotentRequest): MaybePromise<void>;
}

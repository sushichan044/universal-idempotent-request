import type { IdempotentCacheLookupKey } from "./brand/idempotent-cache-lookup-key";
import type { SerializedResponse } from "./utils/response";

export interface IdempotentRequestRecord {
  /** Time when the request was first processed */
  createdAt: Date;

  /** Request fingerprint */
  fingerprint: string;

  /** Idempotency-Key */
  idempotencyKey: string;

  /**
   * Time when the request was locked for processing
   *
   * This is used to prevent race conditions when multiple requests are
   * trying to process the same request concurrently.
   */
  lockedAt: Date | null;

  /** Stored response (null on initial execution) */
  response: SerializedResponse | null;
}

type NewIdempotentRequest = Pick<
  IdempotentRequestRecord,
  "fingerprint" | "idempotencyKey"
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
  create(request: NewIdempotentRequest): Promise<IdempotentRequestRecord>;

  /**
   * Retrieve a stored request associated with the given key.
   *
   * @param lookupKey - Cache lookup key
   * @returns The stored request information if found, null otherwise
   */
  get(
    lookupKey: IdempotentCacheLookupKey,
  ): Promise<IdempotentRequestRecord | null>;

  /**
   * Lock a request to begin processing
   * @param lookupKey - Cache lookup key
   */
  lock(lookupKey: IdempotentCacheLookupKey): Promise<void>;

  /**
   * Unlock a request and store the response
   * @param lookupKey - Cache lookup key
   * @param response - The response to store
   */
  setResponse(
    lookupKey: IdempotentCacheLookupKey,
    response: SerializedResponse,
  ): Promise<void>;

  /**
   * Unlock a request
   * @param lookupKey - Cache lookup key
   */
  unlock(lookupKey: IdempotentCacheLookupKey): Promise<void>;
}

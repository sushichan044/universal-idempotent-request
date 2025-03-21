import type { IdempotentRequestCacheStorage, NewIdempotentRequest } from ".";
import type { IdempotentCacheLookupKey } from "../brand";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";
import type { MaybePromise } from "../utils/types";

/**
 * In-memory implementation of the idempotent request cache storage.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 */
export class InMemoryIdempotentRequestCacheStorage
  implements IdempotentRequestCacheStorage
{
  #createDelay = 0;
  #lockDelay = 0;
  #requests: Map<IdempotentCacheLookupKey, StoredIdempotentRequest>;
  #setResponseDelay = 0;
  #unlockDelay = 0;

  /**
   * @param createDelay
   * Delay in milliseconds before the request is created.
   * This is to simulate a slow database.
   */
  constructor(
    args: Partial<{
      createDelay: number;
      lockDelay: number;
      setResponseDelay: number;
      unlockDelay: number;
    }> = {},
  ) {
    this.#requests = new Map();

    this.#createDelay = args.createDelay ?? 0;
    this.#lockDelay = args.lockDelay ?? 0;
    this.#setResponseDelay = args.setResponseDelay ?? 0;
    this.#unlockDelay = args.unlockDelay ?? 0;
  }

  async create(
    request: NewIdempotentRequest,
  ): Promise<NonLockedIdempotentRequest> {
    await new Promise((resolve) => setTimeout(resolve, this.#createDelay));

    const existingRequest = this.#requests.get(request.cacheLookupKey);
    if (existingRequest) {
      throw new Error("Request already exists");
    }

    const nonLockedRequest: NonLockedIdempotentRequest = {
      ...request,
      createdAt: new Date(),
      lockedAt: null,
      response: null,
      updatedAt: new Date(),
    };
    this.#requests.set(request.cacheLookupKey, nonLockedRequest);
    return nonLockedRequest;
  }

  get(
    lookupKey: IdempotentCacheLookupKey,
  ): MaybePromise<StoredIdempotentRequest | null> {
    return this.#requests.get(lookupKey) ?? null;
  }

  async lock(
    nonLockedRequest: NonLockedIdempotentRequest,
  ): Promise<LockedIdempotentRequest> {
    await new Promise((resolve) => setTimeout(resolve, this.#lockDelay));

    const lockedRequest: LockedIdempotentRequest = {
      ...nonLockedRequest,
      lockedAt: new Date(),
    };
    this.#requests.set(nonLockedRequest.cacheLookupKey, lockedRequest);

    return lockedRequest;
  }

  async setResponse(
    lockedRequest: LockedIdempotentRequest,
    response: SerializedResponse,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.#setResponseDelay));

    this.#requests.set(lockedRequest.cacheLookupKey, {
      ...lockedRequest,
      response,
      updatedAt: new Date(),
    });
  }

  async unlock(
    lockedRequest: LockedIdempotentRequest,
  ): Promise<NonLockedIdempotentRequest> {
    await new Promise((resolve) => setTimeout(resolve, this.#unlockDelay));

    const nonLockedRequest: NonLockedIdempotentRequest = {
      ...lockedRequest,
      lockedAt: null,
    };
    this.#requests.set(lockedRequest.cacheLookupKey, nonLockedRequest);

    return nonLockedRequest;
  }
}

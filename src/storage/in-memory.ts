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
 * In-memory implementation of idempotent request cache storage by function.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 */
export const createInMemoryIdempotentRequestCacheStorage = (
  options: Partial<{
    createDelay: number;
    lockDelay: number;
    setResponseDelay: number;
    unlockDelay: number;
  }> = {},
): IdempotentRequestCacheStorage => {
  const requests = new Map<IdempotentCacheLookupKey, StoredIdempotentRequest>();
  const createDelay = options.createDelay ?? 0;
  const lockDelay = options.lockDelay ?? 0;
  const setResponseDelay = options.setResponseDelay ?? 0;
  const unlockDelay = options.unlockDelay ?? 0;

  return {
    async create(
      request: NewIdempotentRequest,
    ): Promise<NonLockedIdempotentRequest> {
      await new Promise((resolve) => setTimeout(resolve, createDelay));

      const existingRequest = requests.get(request.cacheLookupKey);
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
      requests.set(request.cacheLookupKey, nonLockedRequest);
      return nonLockedRequest;
    },

    get(
      lookupKey: IdempotentCacheLookupKey,
    ): MaybePromise<StoredIdempotentRequest | null> {
      return requests.get(lookupKey) ?? null;
    },

    async lock(
      nonLockedRequest: NonLockedIdempotentRequest,
    ): Promise<LockedIdempotentRequest> {
      await new Promise((resolve) => setTimeout(resolve, lockDelay));

      const lockedRequest: LockedIdempotentRequest = {
        ...nonLockedRequest,
        lockedAt: new Date(),
      };
      requests.set(nonLockedRequest.cacheLookupKey, lockedRequest);

      return lockedRequest;
    },

    async setResponse(
      lockedRequest: LockedIdempotentRequest,
      response: SerializedResponse,
    ): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, setResponseDelay));

      requests.set(lockedRequest.cacheLookupKey, {
        ...lockedRequest,
        response,
        updatedAt: new Date(),
      });
    },

    async unlock(
      lockedRequest: LockedIdempotentRequest,
    ): Promise<NonLockedIdempotentRequest> {
      await new Promise((resolve) => setTimeout(resolve, unlockDelay));

      const nonLockedRequest: NonLockedIdempotentRequest = {
        ...lockedRequest,
        lockedAt: null,
      };
      requests.set(lockedRequest.cacheLookupKey, nonLockedRequest);

      return nonLockedRequest;
    },
  };
};

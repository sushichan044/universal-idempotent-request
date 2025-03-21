import type { IdempotentRequestCacheStorage, NewIdempotentRequest } from ".";
import type { IdempotentCacheLookupKey } from "../brand";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";

import { IdempotencyKeyConflictError } from "../error";
import { IdempotencyKeyFingerprintMismatchError } from "../error";

/**
 * In-memory implementation of idempotent request cache storage by function.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 */
export const createInMemoryIdempotentRequestCacheStorage =
  (): IdempotentRequestCacheStorage => {
    const requests = new Map<
      IdempotentCacheLookupKey,
      StoredIdempotentRequest
    >();

    const getImpl = (
      lookupKey: IdempotentCacheLookupKey,
    ): StoredIdempotentRequest | null => {
      return requests.get(lookupKey) ?? null;
    };

    return {
      create(request: NewIdempotentRequest): NonLockedIdempotentRequest {
        const existingRequest = getImpl(request.cacheLookupKey);

        if (existingRequest != null) {
          if (existingRequest.fingerprint !== request.fingerprint) {
            throw new IdempotencyKeyFingerprintMismatchError();
          }

          if (existingRequest.lockedAt != null) {
            throw new IdempotencyKeyConflictError();
          }

          if (existingRequest.response != null) {
            return existingRequest;
          }
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

      get: getImpl,

      lock(
        nonLockedRequest: NonLockedIdempotentRequest,
      ): LockedIdempotentRequest {
        const lockedRequest: LockedIdempotentRequest = {
          ...nonLockedRequest,
          lockedAt: new Date(),
        };
        requests.set(nonLockedRequest.cacheLookupKey, lockedRequest);

        return lockedRequest;
      },

      setResponse(
        lockedRequest: LockedIdempotentRequest,
        response: SerializedResponse,
      ): void {
        requests.set(lockedRequest.cacheLookupKey, {
          ...lockedRequest,
          response,
          updatedAt: new Date(),
        });
      },

      unlock(
        lockedRequest: LockedIdempotentRequest,
      ): NonLockedIdempotentRequest {
        const nonLockedRequest: NonLockedIdempotentRequest = {
          ...lockedRequest,
          lockedAt: null,
        };
        requests.set(lockedRequest.cacheLookupKey, nonLockedRequest);

        return nonLockedRequest;
      },
    };
  };

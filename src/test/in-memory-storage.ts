import type { IdempotentStorageKey } from "../brand";
import type {
  IdempotentRequestStorage,
  NewIdempotentRequest,
} from "../storage";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";

import {
  IdempotencyKeyConflictError,
  IdempotencyKeyPayloadMismatchError,
} from "../error";

/**
 * In-memory implementation of idempotent request cache storage by function.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 */
export const createInMemoryIdempotentRequestCacheStorage =
  (): IdempotentRequestStorage => {
    const requests = new Map<IdempotentStorageKey, StoredIdempotentRequest>();

    const getImpl = (
      lookupKey: IdempotentStorageKey,
    ): StoredIdempotentRequest | null => {
      return requests.get(lookupKey) ?? null;
    };

    return {
      create(request: NewIdempotentRequest): NonLockedIdempotentRequest {
        const existingRequest = getImpl(request.storageKey);

        if (existingRequest != null) {
          if (existingRequest.fingerprint !== request.fingerprint) {
            throw new IdempotencyKeyPayloadMismatchError();
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
          lockedAt: null,
          response: null,
        };
        requests.set(request.storageKey, nonLockedRequest);
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
        requests.set(nonLockedRequest.storageKey, lockedRequest);

        return lockedRequest;
      },

      setResponseAndUnlock(
        lockedRequest: LockedIdempotentRequest,
        response: SerializedResponse,
      ): void {
        requests.set(lockedRequest.storageKey, {
          ...lockedRequest,
          lockedAt: null,
          response,
        });
      },
    };
  };

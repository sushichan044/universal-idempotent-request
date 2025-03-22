import type { IdempotentStorageKey } from "../brand";
import type {
  FindOrCreateStorageResult,
  IdempotentRequestStorage,
  NewIdempotentRequest,
} from "../storage";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  StoredIdempotentRequest,
} from "../types";
import type { SerializedResponse } from "../utils/response";

/**
 * In-memory implementation of idempotent request cache storage by function.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 */
export const createInMemoryIdempotentRequestCacheStorage =
  (): IdempotentRequestStorage => {
    const requests = new Map<IdempotentStorageKey, StoredIdempotentRequest>();

    return {
      findOrCreate(request: NewIdempotentRequest): FindOrCreateStorageResult {
        const existingRequest = requests.get(request.storageKey) ?? null;

        if (existingRequest !== null) {
          return {
            created: false,
            storedRequest: existingRequest,
          };
        }

        const nonLockedRequest: NonLockedIdempotentRequest = {
          ...request,
          lockedAt: null,
          response: null,
        };
        requests.set(request.storageKey, nonLockedRequest);
        return {
          created: true,
          storedRequest: nonLockedRequest,
        };
      },

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

import type {
  IdempotentRequestStorage,
  NewIdempotentRequest,
} from "hono-idempotent-request/storage";
import type {
  LockedIdempotentRequest,
  NonLockedIdempotentRequest,
  SerializedResponse,
  StoredIdempotentRequest,
} from "hono-idempotent-request/types";

const getExpirationEpoch = (ttl: number) => {
  const nowEpoch = Date.now() / 1000;
  return nowEpoch + ttl;
};

export const createIdempotentRequestStorage = (
  kv: KVNamespace,
): IdempotentRequestStorage => {
  const TTL_ONE_HOUR = 60 * 60;

  return {
    findOrCreate: async (request: NewIdempotentRequest) => {
      const sunset = getExpirationEpoch(TTL_ONE_HOUR);

      const existing = await kv.get<StoredIdempotentRequest>(
        request.storageKey,
        "json",
      );

      if (existing) {
        return {
          created: false,
          storedRequest: existing,
        };
      }

      const newRequest: NonLockedIdempotentRequest = {
        ...request,
        lockedAt: null,
        response: null,
      };

      await kv.put(request.storageKey, JSON.stringify(newRequest), {
        expiration: sunset,
      });

      return {
        created: true,
        storedRequest: newRequest,
      };
    },

    lock: async (request: NonLockedIdempotentRequest) => {
      const lockedRequest: LockedIdempotentRequest = {
        ...request,
        lockedAt: new Date(),
      };

      await kv.put(request.storageKey, JSON.stringify(lockedRequest));

      return lockedRequest;
    },

    setResponseAndUnlock: async (
      request: LockedIdempotentRequest,
      response: SerializedResponse,
    ) => {
      const unlockedRequest: NonLockedIdempotentRequest = {
        ...request,
        lockedAt: null,
        response,
      };

      await kv.put(request.storageKey, JSON.stringify(unlockedRequest));
    },
  };
};

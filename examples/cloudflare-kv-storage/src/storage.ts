import type {
  IdempotentRequest,
  IdempotentRequestStorageAdapter,
} from "universal-idempotent-request";

const getExpirationEpoch = (ttlSeconds: number) => {
  const nowEpoch = Date.now() / 1000;
  return nowEpoch + ttlSeconds;
};

export const createCloudflareKVStorageAdapter = (
  kv: KVNamespace,
): IdempotentRequestStorageAdapter => {
  const TTL_ONE_HOUR = 60 * 60;

  return {
    async get(storageKey) {
      return await kv.get<IdempotentRequest>(storageKey, "json");
    },
    async save(request) {
      const sunset = getExpirationEpoch(TTL_ONE_HOUR);

      await kv.put(request.storageKey, JSON.stringify(request), {
        expiration: sunset,
      });
    },
    async update(request) {
      await kv.put(request.storageKey, JSON.stringify(request));
    },
  };
};

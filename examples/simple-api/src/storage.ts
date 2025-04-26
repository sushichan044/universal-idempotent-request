import type { IdempotentRequestStorageDriver } from "hono-idempotent-request";

const getExpirationEpoch = (ttlSeconds: number) => {
  const nowEpoch = Date.now() / 1000;
  return nowEpoch + ttlSeconds;
};

export const createCloudflareKVStorageDriver = (
  kv: KVNamespace,
): IdempotentRequestStorageDriver => {
  const TTL_ONE_HOUR = 60 * 60;
  const sunset = getExpirationEpoch(TTL_ONE_HOUR);

  return {
    async get(storageKey) {
      return kv.get(storageKey, "json");
    },
    async save(request) {
      return kv.put(request.storageKey, JSON.stringify(request), {
        expiration: sunset,
      });
    },
  };
};

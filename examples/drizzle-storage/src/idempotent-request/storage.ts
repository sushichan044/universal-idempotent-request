import { eq } from "drizzle-orm";
import {
  createIdempotencyFingerprint,
  createStorageKey,
  type IdempotentRequestStorageDriver,
} from "universal-idempotent-request";

import type { database } from "../db";

import { TB_idempotent_request } from "../db/schema";

const isOutdatedRequest = (
  request: typeof TB_idempotent_request.$inferSelect,
) => {
  return request.created_at.getTime() < Date.now() - 24 * 60 * 60 * 1000;
};

export const createSqliteDrizzleDriver = (
  client: typeof database,
): IdempotentRequestStorageDriver => {
  return {
    async save(request) {
      await client.insert(TB_idempotent_request).values({
        idempotency_key: request.idempotencyKey,
        locked_at: null,
        request_fingerprint: request.fingerprint,
        request_method: request.requestMethod,
        request_path: request.requestPath,
        response_body: null,
        response_headers: null,
        response_status: null,
        storage_key: request.storageKey,
      });
    },

    async update(request) {
      await client
        .update(TB_idempotent_request)
        .set({
          idempotency_key: request.idempotencyKey,
          locked_at: request.lockedAt,
          request_fingerprint: request.fingerprint,
          request_method: request.requestMethod,
          request_path: request.requestPath,
          response_body: request.response?.body,
          response_headers: request.response?.headers,
          response_status: request.response?.status,
          storage_key: request.storageKey,
        })
        .where(eq(TB_idempotent_request.storage_key, request.storageKey));
    },

    async get(storageKey) {
      const result = await client.query.TB_idempotent_request.findFirst({
        where: (requests, { eq }) => {
          return eq(requests.storage_key, storageKey);
        },
      });

      if (result == null) {
        return null;
      }

      // return null if created_at is older than 24 hours
      // You can clean up the old request at here or async in the background job
      if (isOutdatedRequest(result)) {
        return null;
      }

      if (result.locked_at != null) {
        return {
          fingerprint:
            result.request_fingerprint == null
              ? null
              : createIdempotencyFingerprint(result.request_fingerprint),
          idempotencyKey: result.idempotency_key,
          lockedAt: result.locked_at,
          requestMethod: result.request_method,
          requestPath: result.request_path,
          response: null,
          storageKey: createStorageKey(result.storage_key),
        };
      }

      if (
        result.response_body == null ||
        result.response_status == null ||
        result.response_headers == null
      ) {
        return {
          fingerprint:
            result.request_fingerprint == null
              ? null
              : createIdempotencyFingerprint(result.request_fingerprint),
          idempotencyKey: result.idempotency_key,
          lockedAt: result.locked_at,
          requestMethod: result.request_method,
          requestPath: result.request_path,
          response: null,
          storageKey: createStorageKey(result.storage_key),
        };
      }

      return {
        fingerprint:
          result.request_fingerprint == null
            ? null
            : createIdempotencyFingerprint(result.request_fingerprint),
        idempotencyKey: result.idempotency_key,
        lockedAt: result.locked_at,
        requestMethod: result.request_method,
        requestPath: result.request_path,
        response: {
          body: result.response_body,
          headers: result.response_headers,
          status: result.response_status,
        },
        storageKey: createStorageKey(result.storage_key),
      };
    },
  };
};

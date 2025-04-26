// src/middlewares/demo.middleware.ts

import type { Get, UniversalMiddleware } from "@universal-middleware/core";

import type { Hooks } from "./hooks";
import type { UnProcessedIdempotentRequest } from "./idempotent-request";
import type { IdempotentRequestServerSpecification } from "./server/specification";
import type { IdempotentRequestStorageAdapter } from "./storage/driver";
import type { IdempotencyActivationStrategy } from "./strategy";

import {
  createIdempotencyKeyConflictErrorResponse,
  createIdempotencyKeyMissingErrorResponse,
  createIdempotencyKeyPayloadMismatchErrorResponse,
} from "./constants/response";
import { UnsafeImplementationError } from "./error";
import { resolveHooks } from "./hooks";
import { isIdenticalRequest } from "./identifier";
import { cloneAndSerializeResponse, deserializeResponse } from "./serializer";
import { createIdempotentRequestServer } from "./server";
import { createIdempotentRequestStorage } from "./storage";
import { prepareActivationStrategy } from "./strategy";

export interface IdempotentRequestImplementation {
  /**
   * Strategy for activating idempotency processing
   *
   * As a string:
   * - `"always"`: Always apply idempotency processing
   * - `"opt-in"`: Apply idempotency processing only if the Idempotency-Key header exists
   *
   * As a function:
   * - A function that determines whether to apply idempotency processing using custom logic
   *   - YOU MUST CHECK EXISTENCE OF `Idempotency-Key` HEADER.
   *   - Useful when you are using strategies like feature flags
   *   - Return `true` to apply idempotency processing, `false` otherwise
   *
   * @default "always"
   *
   * @example
   * ```ts
   * (req) => {
   *    return (
   *     typeof req.headers.get("Idempotency-Key") === "string" &&
   *     req.headers.get("X-Enable-Idempotency") === "true"
   *   );
   * };
   */
  activationStrategy?: IdempotencyActivationStrategy;

  hooks?: Partial<Hooks>;

  /**
   * Server options
   */
  server: {
    /**
     * Server specification
     */
    specification: IdempotentRequestServerSpecification;
  };

  /**
   * Storage options
   *
   * You should implement features like TTL, cleanup, etc. at this layer.
   */
  storage: {
    /**
     * Storage driver implementation.
     */
    driver: IdempotentRequestStorageAdapter;
  };
}

export const idempotentRequestUniversalMiddleware = ((impl) =>
  async (request) => {
    const idempotencyStrategyFunction = prepareActivationStrategy(
      impl.activationStrategy ?? "always",
    );
    const hooks = resolveHooks(impl.hooks);

    const isIdempotencyEnabled = await idempotencyStrategyFunction(
      request.clone(),
    );

    if (!isIdempotencyEnabled) {
      return;
    }

    const server = createIdempotentRequestServer(impl.server.specification);
    const storage = createIdempotentRequestStorage(impl.storage.driver);

    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey == null || !server.satisfiesKeySpec(idempotencyKey)) {
      return await hooks.modifyResponse(
        createIdempotencyKeyMissingErrorResponse(),
        "key_missing",
      );
    }

    const storageKey = await server.getStorageKey({
      idempotencyKey,
      request: request.clone(),
    });
    if (!storageKey.includes(idempotencyKey)) {
      throw new UnsafeImplementationError(
        "The storage-key must include the value of the `Idempotency-Key` header.",
      );
    }

    const requestIdentifier = await server.getRequestIdentifier({
      idempotencyKey,
      request: request.clone(),
    });

    const storeResult = await storage.findOrCreate({
      ...requestIdentifier,
      storageKey,
    });

    let unprocessedRequest: UnProcessedIdempotentRequest;
    if (storeResult.created) {
      unprocessedRequest = storeResult.request;
    } else {
      // Retried request - compare with the stored request
      if (!isIdenticalRequest(storeResult.request, requestIdentifier)) {
        return await hooks.modifyResponse(
          createIdempotencyKeyPayloadMismatchErrorResponse(),
          "key_payload_mismatch",
        );
      }

      if (storeResult.request.lockedAt != null) {
        return await hooks.modifyResponse(
          createIdempotencyKeyConflictErrorResponse(),
          "key_conflict",
        );
      }

      if (storeResult.request.response) {
        return await hooks.modifyResponse(
          deserializeResponse(storeResult.request.response),
          "retrieved_stored_response",
        );
      }

      // If we reach this point, the previous request failed to acquire a lock.
      // So just continue to re-try lock and process the request.
      unprocessedRequest = storeResult.request;
    }

    const lockedRequest = await storage.acquireLock(unprocessedRequest);

    // The route handler is executed here.

    return async (serverResponse) => {
      const modifiedResponse = await hooks.modifyResponse(
        serverResponse,
        "success",
      );

      // Even if route handler throws an error, this operation will be executed.
      await storage.setResponseAndUnlock(
        lockedRequest,
        await cloneAndSerializeResponse(modifiedResponse),
      );

      return modifiedResponse;
    };
  }) satisfies Get<[IdempotentRequestImplementation], UniversalMiddleware>;

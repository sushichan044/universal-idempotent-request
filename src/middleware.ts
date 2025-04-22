// src/middlewares/demo.middleware.ts

import type { Get, UniversalMiddleware } from "@universal-middleware/core";

import type { IdempotentRequestServerSpecification } from "./server-specification";
import type { IdempotentRequestStorage } from "./storage";
import type { NonLockedIdempotentRequest } from "./types";

import { IdempotencyKeyStorageError, UnsafeImplementationError } from "./error";
import { type Hooks, resolveHooks } from "./hooks";
import { createRequestIdentifier, isIdenticalRequest } from "./identifier";
import {
  createIdempotencyKeyConflictErrorResponse,
  createIdempotencyKeyMissingErrorResponse,
  createIdempotencyKeyPayloadMismatchErrorResponse,
} from "./response";
import {
  type IdempotencyActivationStrategy,
  prepareActivationStrategy,
} from "./strategy";
import {
  cloneAndSerializeResponse,
  deserializeResponse,
} from "./utils/response";

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
   * Server specification
   */
  specification: IdempotentRequestServerSpecification;

  /**
   * Storage implementation
   *
   * You should implement features like TTL, cleanup, etc. at this layer.
   */
  storage: IdempotentRequestStorage;
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

    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (
      idempotencyKey == null ||
      !impl.specification.satisfiesKeySpec(idempotencyKey)
    ) {
      return await hooks.modifyResponse(
        createIdempotencyKeyMissingErrorResponse(),
        "key_missing",
      );
    }

    const requestIdentifier = await createRequestIdentifier(
      impl.specification,
      {
        idempotencyKey,
        request: request.clone(),
      },
    );
    const storageKey = await impl.specification.getStorageKey(request.clone());
    if (!storageKey.includes(idempotencyKey)) {
      throw new UnsafeImplementationError(
        "The storage-key must include the value of the `Idempotency-Key` header.",
      );
    }

    const storeResult = await (async () => {
      try {
        return impl.storage.findOrCreate({
          ...requestIdentifier,
          storageKey,
        });
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          "Failed to find or create the stored idempotent request",
          {
            cause: error,
          },
        );
      }
    })();

    if (!storeResult.created) {
      // Retried request - compare with the stored request
      if (!isIdenticalRequest(storeResult.storedRequest, requestIdentifier)) {
        return await hooks.modifyResponse(
          createIdempotencyKeyPayloadMismatchErrorResponse(),
          "key_payload_mismatch",
        );
      }

      if (storeResult.storedRequest.lockedAt != null) {
        // The request is locked - still being processed, or processing succeeded but the response failed to be recorded.
        return await hooks.modifyResponse(
          createIdempotencyKeyConflictErrorResponse(),
          "key_conflict",
        );
      }

      if (storeResult.storedRequest.response) {
        //              ^?
        // TIP: ^? above is called `Two slash query` in TypeScript. see: https://www.typescriptlang.org/dev/twoslash
        // Already processed - return the stored response
        return await hooks.modifyResponse(
          deserializeResponse(storeResult.storedRequest.response),
          "retrieved_stored_response",
        );
      }

      // If you reach this point, the previous request simply failed to acquire a lock.
      // So just continue to re-try lock and process the request.
    }

    // Only for suppressing type error.
    // We can assume that the request is not locked at this point.
    // because we already called createIdempotencyKeyConflictErrorResponse()
    // if situation like { created: false, storedRequest: LockedIdempotentRequest }
    const nonLockedRequest =
      storeResult.storedRequest as NonLockedIdempotentRequest;

    const lockedRequest = await (async () => {
      try {
        return impl.storage.lock(nonLockedRequest);
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          "Failed to lock the stored idempotent request",
          {
            cause: error,
          },
        );
      }
    })();

    return async (serverResponse) => {
      const modifiedResponse = await hooks.modifyResponse(
        serverResponse,
        "success",
      );

      // Even if route handler throws an error, this operation will be executed.
      try {
        await impl.storage.setResponseAndUnlock(
          lockedRequest,
          await cloneAndSerializeResponse(modifiedResponse),
        );
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          "Failed to save the response of an idempotent request. You should unlock the request manually.",
          {
            cause: error,
          },
        );
      }

      return modifiedResponse;
    };
  }) satisfies Get<[IdempotentRequestImplementation], UniversalMiddleware>;

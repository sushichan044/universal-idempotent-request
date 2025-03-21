import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { IdempotentRequestServerSpecification } from "./server-specification";
import type { IdempotentRequestStorage } from "./storage";
import type { IdempotencyActivationStrategy } from "./strategy";
import type { NonLockedIdempotentRequest } from "./types";

import {
  IdempotencyKeyConflictError,
  IdempotencyKeyMissingError,
  IdempotencyKeyPayloadMismatchError,
  IdempotencyKeyStorageError,
} from "./error";
import { prepareActivationStrategy } from "./strategy";
import { deserializeResponse, serializeResponse } from "./utils/response";

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
   *   - Useful when you are using strategies like feature flags
   *   - Return `true` to apply idempotency processing, `false` otherwise
   *
   * @default "always"
   */
  activationStrategy?: IdempotencyActivationStrategy;

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

/**
 * Create a Hono middleware for handling idempotent requests
 * @param impl - Injectable implementation
 */
export const idempotentRequest = (impl: IdempotentRequestImplementation) => {
  const idempotencyStrategyFunction = prepareActivationStrategy(
    impl.activationStrategy,
  );

  return createMiddleware(async (c, next) => {
    const isIdempotencyEnabled = await idempotencyStrategyFunction(
      c.req.raw.clone(),
    );

    if (!isIdempotencyEnabled) {
      return await next();
    }

    try {
      const idempotencyKey = c.req.header("Idempotency-Key");
      if (idempotencyKey === undefined) {
        throw new IdempotencyKeyMissingError();
      }

      if (!impl.specification.satisfiesKeySpec(idempotencyKey)) {
        // Omit idempotency processing because the key does not satisfy the server-defined specifications
        return await next();
      }

      const fingerprint = await impl.specification.getFingerprint(
        c.req.raw.clone(),
      );

      const storageKey = await impl.specification.getStorageKey(
        c.req.raw.clone(),
      );
      const storedRequest = await impl.storage.get(storageKey);

      let nonLockedRequest: NonLockedIdempotentRequest | null = null;
      if (storedRequest) {
        // Retried request - compare with the stored request
        if (storedRequest.fingerprint !== fingerprint) {
          // see: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-5:~:text=If%20there%20is%20an%20attempt%20to%20reuse%20an%20idempotency%20key%20with%20a%20different%0A%20%20%20request%20payload
          throw new IdempotencyKeyPayloadMismatchError();
        }

        if (storedRequest.lockedAt != null) {
          // the request is locked, still being processed
          throw new IdempotencyKeyConflictError();
        }

        if (storedRequest.response) {
          // Successfully processed - return the cached response
          return deserializeResponse(storedRequest.response);
        }

        // Previous request was not processed - maybe failed
        nonLockedRequest = storedRequest;
      } else {
        // New request - prepare for processing
        try {
          nonLockedRequest = await impl.storage.create({
            fingerprint,
            storageKey: storageKey,
          });
        } catch (error) {
          throw new IdempotencyKeyStorageError(
            "Failed to create a new idempotent request",
            {
              cause: error,
            },
          );
        }
      }

      const lockedRequest = await (async () => {
        try {
          return await impl.storage.lock(nonLockedRequest);
        } catch (error) {
          throw new IdempotencyKeyStorageError(
            "Failed to lock the idempotent request",
            {
              cause: error,
            },
          );
        }
      })();

      // Execute hono route handler
      await next();

      try {
        await impl.storage.setResponseAndUnlock(
          lockedRequest,
          await serializeResponse(c.res),
        );
      } catch (error) {
        throw new IdempotencyKeyStorageError(
          "Failed to save the response of an idempotent request. You should unlock the request manually.",
          {
            cause: error,
          },
        );
      }

      return c.res;
    } catch (error) {
      if (error instanceof IdempotencyKeyMissingError) {
        throw new HTTPException(400, {
          message: "Idempotency-Key is missing",
        });
      }

      if (error instanceof IdempotencyKeyPayloadMismatchError) {
        throw new HTTPException(422, {
          message: "Idempotency-Key is already used",
        });
      }

      if (error instanceof IdempotencyKeyConflictError) {
        throw new HTTPException(409, {
          message: "A request is outstanding for this Idempotency-Key",
        });
      }

      throw error;
    }
  });
};

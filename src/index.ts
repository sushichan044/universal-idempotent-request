import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { IdempotentRequestCacheStorage } from "./storage";
import type { IdempotentRequestServerSpecification } from "./server-specification";

import {
  type IdempotencyActivationStrategy,
  prepareActivationStrategy,
} from "./strategy";
import { deserializeResponse, serializeResponse } from "./utils/response";
import { isNonEmptyString } from "./utils/string";
import type { NonLockedIdempotentRequest } from "./types";

export interface IdempotentRequestOptions {
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

  /** Specification - defines key validation and request digest generation */
  specification: IdempotentRequestServerSpecification;

  /** Storage - for storing and retrieving idempotent request information */
  storage: IdempotentRequestCacheStorage;
}

/**
 * Create a Hono middleware for handling idempotent requests
 * @param options - Middleware configuration options
 */
export const idempotentRequest = ({
  activationStrategy,
  specification,
  storage,
}: IdempotentRequestOptions) => {
  const idempotencyStrategyFn = prepareActivationStrategy(activationStrategy);

  return createMiddleware(async (c, next) => {
    const isIdempotencyEnabled = await idempotencyStrategyFn(c.req);

    if (!isIdempotencyEnabled) {
      return await next();
    }

    const idempotencyKey = c.req.header("Idempotency-Key");
    if (!isNonEmptyString(idempotencyKey)) {
      throw new HTTPException(400, {
        message: "Idempotency-Key is missing",
      });
    }

    // Validate key satisfies server-defined specifications
    // see: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7
    if (!specification.isValidKey(idempotencyKey)) {
      throw new HTTPException(400, {
        message:
          "Idempotency-Key format did not satisfy server-defined specifications.",
      });
    }

    const fingerprint = await specification.getFingerprint(c.req);
    const cacheLookupKey = await specification.getCacheLookupKey(c.req);
    const cachedRequest = await storage.get(cacheLookupKey);

    let nonLockedRequest: NonLockedIdempotentRequest | null = null;
    if (!cachedRequest) {
      // New request - prepare for processing
      nonLockedRequest = await storage.create({ cacheLookupKey, fingerprint });
    } else {
      // Retried request - compare with the cached request
      if (cachedRequest.fingerprint !== fingerprint) {
        // see: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-5:~:text=If%20there%20is%20an%20attempt%20to%20reuse%20an%20idempotency%20key%20with%20a%20different%0A%20%20%20request%20payload
        throw new HTTPException(422, {
          message: "Idempotency-Key is already used",
        });
      }

      if (cachedRequest.lockedAt != null) {
        // the request is locked, still being processed
        throw new HTTPException(409, {
          message: "A request is outstanding for this Idempotency-Key",
        });
      }

      if (cachedRequest.response) {
        // Successfully processed - return the cached response
        return deserializeResponse(cachedRequest.response);
      }

      // Previous request was not processed - maybe failed
      nonLockedRequest = cachedRequest;
    }

    // Execute the original request processing
    const lockedRequest = await storage.lock(nonLockedRequest);
    await next();
    await storage.setResponse(lockedRequest, await serializeResponse(c.res));
    await storage.unlock(lockedRequest);

    return c.res;
  });
};

export type { IdempotencyActivationStrategy };
export type { IdempotentRequestServerSpecification };
export type { IdempotentRequestCacheStorage };

export default idempotentRequest;

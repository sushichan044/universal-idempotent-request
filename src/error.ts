/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */

/**
 * If the Idempotency-Key request header is missing for a documented
 * idempotent operation requiring this header, the resource SHOULD reply
 * with an HTTP 400 status code with body containing a link pointing to
 * relevant documentation.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export class IdempotencyKeyMissingError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyMissingError";
  }
}

/**
 * If the request is retried, while the original request is still being
 * processed, the resource SHOULD reply with an HTTP 409 status code
 * with body containing problem description.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export class IdempotencyKeyConflictError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyConflictError";
  }
}

/**
 * If there is an attempt to reuse an idempotency key with a different
 * request payload, the resource SHOULD reply with a HTTP 422 status
 * code with body containing a link pointing to relevant documentation.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export class IdempotencyKeyPayloadMismatchError extends Error {
  constructor() {
    super();
    this.name = "IdempotencyKeyPayloadMismatchError";
  }
}

/**
 * If the storage operation fails, this error is thrown.
 *
 * The draft does not provide specific error handling methods, but it must be treated as a negative scenario.
 */
export class IdempotencyKeyStorageError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IdempotencyKeyStorageError";
  }
}

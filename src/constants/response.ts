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
export const createIdempotencyKeyMissingErrorResponse = () =>
  new Response(
    JSON.stringify({
      detail:
        "This operation is idempotent and it requires correct usage of Idempotency Key.",
      title: "Idempotency-Key is missing",
    }),
    {
      headers: {
        "Content-Type": "application/problem+json",
      },
      status: 400,
    },
  );

/**
 * If the request is retried, while the original request is still being
 * processed, the resource SHOULD reply with an HTTP 409 status code
 * with body containing problem description.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export const createIdempotencyKeyConflictErrorResponse = () =>
  new Response(
    JSON.stringify({
      detail:
        "A request with the same Idempotency-Key for the same operation is being processed or is outstanding.",
      title: "A request is outstanding for this Idempotency-Key",
    }),
    {
      headers: {
        "Content-Type": "application/problem+json",
      },
      status: 409,
    },
  );

/**
 * If there is an attempt to reuse an idempotency key with a different
 * request payload, the resource SHOULD reply with a HTTP 422 status
 * code with body containing a link pointing to relevant documentation.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7}
 */
export const createIdempotencyKeyPayloadMismatchErrorResponse = () =>
  new Response(
    JSON.stringify({
      detail:
        "This operation is idempotent and it requires correct usage of Idempotency Key. Idempotency Key MUST not be reused across different payloads of this operation.",
      title: "Idempotency-Key is already used",
    }),
    {
      headers: {
        "Content-Type": "application/problem+json",
      },
      status: 422,
    },
  );

import type {
  IdempotencyFingerprint,
  IdempotentCacheLookupKey,
} from "../brand";
import type { MaybePromise } from "../utils/types";

/**
 * Specification - defines key validation and request digest generation.
 *
 * @see Section 2.2, 2.3, 2.4 of {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2}
 */
export interface IdempotentRequestServerSpecification {
  /**
   * Get a cache lookup key for the request
   * @param request - The Hono request to process
   * @returns A cache lookup key that is used to retrieve the request from the storage.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-5 Security Considerations}
   */
  getCacheLookupKey(request: Request): MaybePromise<IdempotentCacheLookupKey>;

  /**
   * Get a fingerprint for the request
   * @param request - The Hono request to process
   * @returns A fingerprint string representing the uniqueness of the request.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.4 Idempotency Fingerprint}
   */
  getFingerprint(request: Request): MaybePromise<IdempotencyFingerprint>;

  /**
   * Check if the idempotency key satisfies the server-defined specifications
   * @param idempotencyKey - The `Idempotency-Key` header from the request
   * @returns Whether the key conforms to the server-defined specifications
   */
  isValidKey(idempotencyKey: string): boolean;
}

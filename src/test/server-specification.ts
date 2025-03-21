import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { version as uuidVersion } from "uuid";

import type { IdempotentRequestServerSpecification } from "../server-specification/index";

import {
  createIdempotencyFingerprint,
  createIdempotentCacheLookupKey,
  type IdempotencyFingerprint,
  type IdempotentCacheLookupKey,
} from "../brand";

/**
 * Idempotent request server specification for testing purposes.
 *
 * This is a simple implementation that is not suitable for production use.
 * It is only meant to be used for testing purposes.
 *
 * - Idempotency-Key format: `uuidv4`
 */
export const createTestServerSpecification =
  (): IdempotentRequestServerSpecification => {
    return {
      getCacheLookupKey(request: Request): IdempotentCacheLookupKey {
        const key = `${request.method}-${request.url}-${request.headers.get("Idempotency-Key")}`;
        return createIdempotentCacheLookupKey(key);
      },

      async getFingerprint(request: Request): Promise<IdempotencyFingerprint> {
        return createIdempotencyFingerprint(await generateHash(request));
      },

      isValidKey(idempotencyKey: string): boolean {
        try {
          return uuidVersion(idempotencyKey) === 4;
        } catch (error) {
          if (error instanceof TypeError) {
            // https://github.com/uuidjs/uuid?tab=readme-ov-file#uuidversionstr
            return false;
          }

          throw error;
        }
      },
    };
  };

/**
 * Hash function - Generate a hash from the request content
 */
const generateHash = async (request: Request): Promise<string> => {
  const body = await request.text();

  const digestBase = {
    body,
    headers: Object.fromEntries(request.headers.entries()),
    method: request.method,
    url: request.url,
  };

  return hashWithSha256(JSON.stringify(digestBase));
};

/**
 * Calculate SHA-256 hash
 */
const hashWithSha256 = (data: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(data)));
};

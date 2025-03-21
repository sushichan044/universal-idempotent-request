import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { version as uuidVersion } from "uuid";

import type { IdempotentRequestServerSpecification } from "./index";

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
export class TestServerSpecification
  implements IdempotentRequestServerSpecification
{
  getCacheLookupKey(request: Request): IdempotentCacheLookupKey {
    const key = `${request.method}-${request.url}-${request.headers.get("Idempotency-Key")}`;

    return createIdempotentCacheLookupKey(key);
  }

  async getFingerprint(request: Request): Promise<IdempotencyFingerprint> {
    return createIdempotencyFingerprint(await this.#generateHash(request));
  }

  isValidKey(idempotencyKey: string): boolean {
    try {
      const version = uuidVersion(idempotencyKey);
      return version === 4;
    } catch {
      return false;
    }
  }

  async #generateHash(request: Request): Promise<string> {
    const body = await request.text();

    const digestBase = {
      body,
      headers: Object.fromEntries(request.headers.entries()),
      method: request.method,
      url: request.url,
    };

    return hashWithSha256(JSON.stringify(digestBase));
  }
}

const hashWithSha256 = (data: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(data)));
};

import type { IdempotentRequestServerSpecification } from "hono-idempotent-request/server-specification";

import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import {
  createIdempotencyFingerprint,
  createIdempotentStorageKey,
} from "hono-idempotent-request/brand";
import * as v from "valibot";

export const simpleSpecification: IdempotentRequestServerSpecification = {
  getFingerprint: async (request) => {
    const body = await request.text();
    return createIdempotencyFingerprint(hashWithSha256(body));
  },
  getStorageKey: (request) => {
    const path = new URL(request.url).pathname;
    const key = request.headers.get("Idempotency-Key");

    return createIdempotentStorageKey(`${path}-${key}`);
  },
  satisfiesKeySpec: (key) => {
    // require uuid
    return v.safeParse(v.pipe(v.string(), v.uuid()), key).success;
  },
};

/**
 * Calculate SHA-256 hash
 */
const hashWithSha256 = (data: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(data)));
};

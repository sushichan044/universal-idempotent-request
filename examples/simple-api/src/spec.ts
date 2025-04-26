import type { IdempotentRequestServerSpecification } from "universal-idempotent-request";

import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import * as v from "valibot";

export const simpleSpecification: IdempotentRequestServerSpecification = {
  getFingerprint: async (request) => {
    const body = await request.text();
    return hashWithSha256(body);
  },

  getStorageKey: ({ idempotencyKey, request }) => {
    const path = new URL(request.url).pathname;

    return `${request.method}-${path}-${idempotencyKey}`;
  },

  satisfiesKeySpec(idempotencyKey) {
    return v.safeParse(v.pipe(v.string(), v.uuid()), idempotencyKey).success;
  },
};

/**
 * Calculate SHA-256 hash
 */
const hashWithSha256 = (data: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(data)));
};

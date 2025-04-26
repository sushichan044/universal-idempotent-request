import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";

/**
 * Calculate SHA-256 hash
 */
export const hashWithSha256 = (data: string): string => {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(data)));
};

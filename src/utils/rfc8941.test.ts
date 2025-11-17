import { describe, expect, it } from "vitest";

import { extractIdempotencyKey, parseStructuredHeader } from "./rfc8941";

describe("RFC8941 Structured Header Parser", () => {
  describe("parseStructuredHeader", () => {
    it("should parse quoted strings correctly", () => {
      const result = parseStructuredHeader('"hello world"');
      expect(result).toBe("hello world");
    });

    it("should handle escaped quotes in quoted strings", () => {
      const result = parseStructuredHeader(String.raw`"hello \"world\""`);
      expect(result).toBe('hello "world"');
    });

    it("should handle escaped backslashes", () => {
      const result = parseStructuredHeader(String.raw`"hello\\world"`);
      expect(result).toBe(String.raw`hello\world`);
    });

    it("should parse bare tokens correctly", () => {
      const result = parseStructuredHeader("hello-world_123");
      expect(result).toBe("hello-world_123");
    });

    it("should reject invalid characters in bare tokens", () => {
      expect(() => parseStructuredHeader("hello world")).toThrow();
      expect(() => parseStructuredHeader("hello@world")).toThrow();
    });

    it("should handle empty quoted strings", () => {
      const result = parseStructuredHeader('""');
      expect(result).toBe("");
    });

    it("should reject unclosed quoted strings", () => {
      expect(() => parseStructuredHeader('"hello world')).toThrow();
    });

    it("should reject invalid escape sequences", () => {
      expect(() => parseStructuredHeader(String.raw`"hello\x"`)).toThrow();
    });
  });

  describe("extractIdempotencyKey", () => {
    it("should extract key from raw header value", () => {
      const result = extractIdempotencyKey('"abc-123"');
      expect(result).toBe("abc-123");
    });

    it("should extract key from bare token", () => {
      const result = extractIdempotencyKey("abc-123");
      expect(result).toBe("abc-123");
    });

    it("should handle complex header with parameters", () => {
      const result = extractIdempotencyKey('"abc-123"; retry=false');
      expect(result).toBe("abc-123");
    });

    it("should return null for invalid headers", () => {
      const result = extractIdempotencyKey("invalid header @#$");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = extractIdempotencyKey("");
      expect(result).toBeNull();
    });

    it("should return null for whitespace only", () => {
      const result = extractIdempotencyKey("   ");
      expect(result).toBeNull();
    });
  });
});

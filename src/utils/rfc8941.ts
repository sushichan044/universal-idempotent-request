import * as structuredHeaders from "structured-headers";

/**
 * Parse a structured header value according to RFC8941
 *
 * @param headerValue - The raw header value to parse
 * @returns The parsed string value
 * @throws Error if the header value is invalid according to RFC8941
 */
export function parseStructuredHeader(headerValue: string): string {
  try {
    // Handle quoted strings
    if (headerValue.startsWith('"') && headerValue.endsWith('"')) {
      return parseQuotedString(headerValue);
    }

    // Handle bare tokens
    return parseBareToken(headerValue);
  } catch (error) {
    throw new Error(
      `Invalid structured header: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Parse a quoted string according to RFC8941
 */
function parseQuotedString(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"') || value.length < 2) {
    throw new Error("Invalid quoted string format");
  }

  const content = value.slice(1, -1);
  let result = "";
  let index = 0;

  while (index < content.length) {
    if (content[index] === "\\") {
      if (index + 1 >= content.length) {
        throw new Error("Invalid escape sequence at end of string");
      }

      const nextChar = content[index + 1];
      if (nextChar === '"' || nextChar === "\\") {
        result += nextChar;
        index += 2;
      } else {
        throw new Error(`Invalid escape sequence: \\${nextChar}`);
      }
    } else {
      result += content[index];
      index++;
    }
  }

  return result;
}

/**
 * Parse a bare token according to RFC8941
 */
function parseBareToken(value: string): string {
  // RFC8941 token characters: ALPHA / DIGIT / "*" / "-" / "." / "_" / ":" / "!" / "#" / "$" / "&" / "'" / "+" / "^" / "`" / "|" / "~"
  const tokenRegex = /^[a-zA-Z0-9*\-._:!#$&'+^`|~]+$/;

  if (!tokenRegex.test(value)) {
    throw new Error("Invalid characters in bare token");
  }

  return value;
}

/**
 * Extract the idempotency key from a structured header value
 *
 * @param headerValue - The raw Idempotency-Key header value
 * @returns The extracted key value or null if invalid
 */
export function extractIdempotencyKey(headerValue: string): string | null {
  if (!headerValue || headerValue.trim() === "") {
    return null;
  }

  const trimmedValue = headerValue.trim();

  try {
    // Extract the main value before any parameters (semicolon-separated)
    const mainValueParts = trimmedValue.split(";");
    const mainValue = mainValueParts[0]?.trim();

    if (mainValue === "" || mainValue === undefined) {
      return null;
    }

    // Use structured-headers library to parse the header properly
    const parsed = structuredHeaders.parseItem(mainValue);

    if (typeof parsed[0] === "string") {
      return parsed[0];
    }

    // Handle Token objects (bare tokens)
    if (
      typeof parsed[0] === "object" &&
      parsed[0] !== null &&
      "value" in parsed[0]
    ) {
      return String((parsed[0] as unknown as { value: unknown }).value);
    }

    return null;
  } catch {
    // Fallback to our simple parser for basic cases
    try {
      const mainValueParts = trimmedValue.split(";");
      const mainValue = mainValueParts[0]?.trim();
      return mainValue !== "" && mainValue !== undefined
        ? parseStructuredHeader(mainValue)
        : null;
    } catch {
      return null;
    }
  }
}

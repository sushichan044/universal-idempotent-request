import { describe, expect, it } from "vitest";

import type { SerializedResponse } from "./response";

import { deserializeResponse, serializeResponse } from "./response";

describe("serializeResponse", () => {
  it("can serialize a response", async () => {
    const mockResponse = new Response("Test body", {
      headers: {
        "Content-Type": "text/plain",
        "X-Test-Header": "test-value",
      },
      status: 200,
    });

    const serialized = await serializeResponse(mockResponse);

    expect(serialized).toStrictEqual({
      body: "Test body",
      headers: {
        "content-type": "text/plain",
        "x-test-header": "test-value",
      },
      status: 200,
    });
  });

  it("should not consume the original response body", async () => {
    const originalResponse = new Response("Test body", {
      headers: {
        "Content-Type": "text/plain",
      },
      status: 200,
    });

    // serialize the response
    await serializeResponse(originalResponse);

    // original response body is not consumed
    // If consumed, this will cause
    // TypeError: Body is unusable: Body has already been read
    const body = await originalResponse.text();
    expect(body).toBe("Test body");
  });
});

describe("deserializeResponse", () => {
  it("can deserialize a serialized response", async () => {
    const serialized = {
      body: "Test body",
      headers: {
        "content-type": "text/plain",
        "x-test-header": "test-value",
      },
      status: 200,
    } satisfies SerializedResponse;

    const response = deserializeResponse(serialized);

    expect(response.status).toBe(200);
    // Headers should be case-insensitive
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("X-Test-Header")).toBe("test-value");
    expect(response.headers.get("x-test-header")).toBe("test-value");

    expect(await response.text()).toBe("Test body");
  });
});

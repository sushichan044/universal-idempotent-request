import { describe, expect, it } from "vitest";

import type { SerializedResponse } from "./serializer";

import { cloneAndSerializeResponse, deserializeResponse } from "./serializer";

describe("serializeResponse", () => {
  it("can serialize a response", async () => {
    const mockResponse = new Response("Test body", {
      headers: {
        "Content-Type": "text/plain",
        "X-Test-Header": "test-value",
      },
      status: 200,
      statusText: "OK",
    });

    const serialized = await cloneAndSerializeResponse(mockResponse);

    expect(serialized).toStrictEqual({
      body: "Test body",
      headers: {
        "content-type": "text/plain",
        "x-test-header": "test-value",
      },
      status: 200,
      statusText: "OK",
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
    await cloneAndSerializeResponse(originalResponse);

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
      statusText: "OK",
    } satisfies SerializedResponse;

    const response = deserializeResponse(serialized);

    expect(response.status).toBe(200);
    expect(response.statusText).toBe("OK");
    // Headers should be case-insensitive
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("X-Test-Header")).toBe("test-value");
    expect(response.headers.get("x-test-header")).toBe("test-value");

    expect(await response.text()).toBe("Test body");
  });
});

describe("BodyInit round-trip", () => {
  it("should round-trip string bodies", async () => {
    const response = new Response("Hello");
    const serialized = await cloneAndSerializeResponse(response);

    const deserialized = deserializeResponse(serialized);

    expect(await deserialized.text()).toBe("Hello");
  });

  it("should round-trip Blob bodies", async () => {
    const blob = new Blob(["Hello Blob"], { type: "text/plain" });
    const serialized = await cloneAndSerializeResponse(new Response(blob));

    const deserialized = deserializeResponse(serialized);

    expect(await deserialized.text()).toBe("Hello Blob");
  });

  it("should round-trip ArrayBuffer bodies", async () => {
    const buf = new TextEncoder().encode("Hello AB").buffer;
    const serialized = await cloneAndSerializeResponse(new Response(buf));

    const deserialized = deserializeResponse(serialized);

    expect(await deserialized.text()).toBe("Hello AB");
  });

  it("should round-trip Uint8Array bodies", async () => {
    const uint8 = new TextEncoder().encode("Hello UA");
    const serialized = await cloneAndSerializeResponse(new Response(uint8));

    const deserialized = deserializeResponse(serialized);

    expect(await deserialized.text()).toBe("Hello UA");
  });

  it("should round-trip URLSearchParams bodies", async () => {
    const usp = new URLSearchParams({ baz: "qux", foo: "bar" });
    const serialized = await cloneAndSerializeResponse(new Response(usp));

    const deserialized = deserializeResponse(serialized);
    const text = await deserialized.text();

    expect(text).toBe(usp.toString());
  });

  it("should round-trip FormData bodies", async () => {
    const fd = new FormData();
    fd.append("key", "value");
    const serialized = await cloneAndSerializeResponse(new Response(fd));

    const deserialized = deserializeResponse(serialized);

    expect(await deserialized.text()).toBe(serialized.body);
  });

  it("should round-trip ReadableStream bodies", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Hello Stream"));
        controller.close();
      },
    });
    const serialized = await cloneAndSerializeResponse(new Response(stream));

    const deserialized = deserializeResponse(serialized);

    expect(await deserialized.text()).toBe("Hello Stream");
  });

  it("should round-trip null bodies", async () => {
    const response = new Response(null);
    const actualBody = await response.text();

    const serialized = await cloneAndSerializeResponse(response);
    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });
});

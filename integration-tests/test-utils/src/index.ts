import type {
  IdempotentRequestServerSpecification,
  IdempotentRequestStorageAdapter,
} from "universal-idempotent-request";

import { idempotentRequestUniversalMiddleware } from "universal-idempotent-request";
import { v4 as uuidv4 } from "uuid";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Racer } from "./racer";

import { createInMemoryAdapter } from "./in-memory-adapter";
import { createRacer } from "./racer";
import {
  createTestServerSpecification,
  createUnsafeServerSpecification,
} from "./server-specification";

/**
 * You need to implement this interface for each frameworks you want to test.
 */
export interface FrameworkTestAdapter {
  fetch(request: Request): Promise<Response>;

  name: string;

  resetApp(): void;

  setupApp(arguments_: SetupAppArguments): void;
}

export type SetupAppArguments = {
  needSimulateSlow: (request: Request) => boolean;
  racer: Racer;
  serverSpecification: IdempotentRequestServerSpecification;
  storageAdapter: IdempotentRequestStorageAdapter;
  universalMiddleware: typeof idempotentRequestUniversalMiddleware;
};

export const runFrameworkIntegrationTest = (framework: FrameworkTestAdapter) =>
  describe(`Idempotency on ${framework.name}`, () => {
    const racer = createRacer({
      concurrency: 2,
      totalDelayOnServer: 100,
    });

    const testSpecification = createTestServerSpecification();
    const memoryAdapter = createInMemoryAdapter();

    const adapterSaveSpy = vi.spyOn(memoryAdapter, "save");

    const setup = ({
      serverSpecification,
      storageAdapter,
    }: Partial<{
      serverSpecification: IdempotentRequestServerSpecification;
      storageAdapter: IdempotentRequestStorageAdapter;
    }> = {}) => {
      serverSpecification ??= testSpecification;
      storageAdapter ??= memoryAdapter;

      framework.setupApp({
        needSimulateSlow(request) {
          return request.headers.get("X-Simulate-Slow") === "true";
        },
        racer,
        serverSpecification,
        storageAdapter,
        universalMiddleware: idempotentRequestUniversalMiddleware,
      });
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    describe("Happy path", () => {
      beforeAll(() => {
        setup();
      });

      afterAll(() => {
        framework.resetApp();
      });

      it("should process request successfully with valid Idempotency-Key", async () => {
        const response = await framework.fetch(
          new Request("http://127.0.0.1:3000/api/test", {
            body: JSON.stringify({ name: "Edison" }),
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": uuidv4(),
            },
            method: "POST",
          }),
        );
        const json = (await response.json()) as Record<string, string>;

        expect(response.status).toBe(200);
        expect(json["message"]).toBe("Test passed");
      });

      it("should return cached response on subsequent requests with same Idempotency-Key", async () => {
        const idempotencyKey = uuidv4();
        const createRequest = () =>
          new Request("http://127.0.0.1:3000/api/test", {
            body: JSON.stringify({ name: "Edison" }),
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            method: "POST",
          });

        const response = await framework.fetch(createRequest());
        const json = (await response.json()) as Record<string, string>;

        const cachedResponse = await framework.fetch(createRequest());
        const cachedJson = (await cachedResponse.json()) as Record<
          string,
          string
        >;

        expect(cachedResponse.status).toBe(response.status);
        expect(cachedJson["message"]).toBe(json["message"]);

        expect(adapterSaveSpy).toHaveBeenCalledOnce();
      });
    });

    describe("Error Scenarios in Draft", () => {
      // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7

      beforeAll(() => {
        setup();
      });

      afterAll(() => {
        framework.resetApp();
      });

      it("should return 400 if Idempotency-Key header is missing", async () => {
        const response = await framework.fetch(
          new Request("http://127.0.0.1:3000/api/test", {
            body: JSON.stringify({ name: "Edison" }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          }),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toStrictEqual({
          detail:
            "This operation is idempotent and it requires correct usage of Idempotency Key.",
          title: "Idempotency-Key is missing",
        });
      });

      it("should return 400 if Idempotency-Key does not satisfy the server specification", async () => {
        const response = await framework.fetch(
          new Request("http://127.0.0.1:3000/api/test", {
            body: JSON.stringify({
              name: "John",
            }),
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": "invalid-key",
            },
            method: "POST",
          }),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toStrictEqual({
          detail:
            "This operation is idempotent and it requires correct usage of Idempotency Key.",
          title: "Idempotency-Key is missing",
        });
      });

      it("should return 422 if Idempotency-Key is reused with different request payload", async () => {
        const idempotencyKey = uuidv4();

        const request = new Request("http://127.0.0.1:3000/api/test", {
          body: JSON.stringify({
            name: "john",
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        });
        const abusedRequest = new Request(request.clone(), {
          body: JSON.stringify({
            name: "UNEXPECTED BODY",
          }),
          method: "POST",
        });

        const response = await framework.fetch(request);
        const abusedResponse = await framework.fetch(abusedRequest);

        expect(response.status).toBe(200);
        expect(abusedResponse.status).toBe(422);
        expect(await abusedResponse.json()).toStrictEqual({
          detail:
            "This operation is idempotent and it requires correct usage of Idempotency Key. Idempotency Key MUST not be reused across different payloads of this operation.",
          title: "Idempotency-Key is already used",
        });
      });

      it("should handle concurrent requests with same Idempotency-Key", async () => {
        const idempotencyKey = uuidv4();

        const createRequest = (headers: Record<string, string> = {}) =>
          new Request("http://127.0.0.1:3000/api/test", {
            body: JSON.stringify({ name: "John" }),
            headers: {
              ...headers,
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            method: "POST",
          });

        const firstSlowRequest = async () =>
          await framework.fetch(
            createRequest({
              "X-Simulate-Slow": "true",
            }),
          );

        const secondRequest = async () => {
          // send second request before first request is stored
          await racer.waitOnClient();
          return await framework.fetch(createRequest());
        };

        const [successResponse, conflictResponse] = await Promise.all([
          // run concurrently
          firstSlowRequest(),
          secondRequest(),
        ]);

        expect(successResponse.status).toBe(200);
        expect(conflictResponse.status).toBe(409);

        expect(await conflictResponse.json()).toStrictEqual({
          detail:
            "A request with the same Idempotency-Key for the same operation is being processed or is outstanding.",
          title: "A request is outstanding for this Idempotency-Key",
        });
      });
    });

    describe("Error handling", () => {
      beforeAll(() => {
        setup();
      });

      afterAll(() => {
        framework.resetApp();
      });

      it("should cache the error response", async () => {
        const request = new Request("http://127.0.0.1:3000/api/error", {
          headers: {
            "Idempotency-Key": uuidv4(),
          },
          method: "POST",
        });

        const response = await framework.fetch(request);
        const text = await response.text();

        const cachedResponse = await framework.fetch(request.clone());
        const cachedText = await cachedResponse.text();

        expect(cachedResponse.status).toBe(response.status);
        expect(cachedText).toBe(text);
        expect(adapterSaveSpy).toHaveBeenCalledOnce();
      });
    });

    describe("Unsafe implementation detection", () => {
      beforeAll(() => {
        setup({
          serverSpecification: createUnsafeServerSpecification(),
        });
      });

      afterAll(() => {
        framework.resetApp();
      });

      it("should throw an error if the storage key does not include the Idempotency-Key header", async () => {
        const response = await framework.fetch(
          new Request("http://127.0.0.1:3000/api/test", {
            headers: {
              "Idempotency-Key": uuidv4(),
            },
            method: "POST",
          }),
        );

        expect(response.status).toBe(500);
      });
    });
  });

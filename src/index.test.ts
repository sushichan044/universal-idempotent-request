import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";

import type { IdempotencyActivationStrategy } from "./strategy";

import idempotentRequest from "./index";
import { createTestServerSpecification } from "./server-specification/test-server";
import { createInMemoryIdempotentRequestCacheStorage } from "./storage/in-memory";

type SetupAppOptions = {
  storage: Parameters<typeof createInMemoryIdempotentRequestCacheStorage>[0];
  strategy: IdempotencyActivationStrategy;
};

const setupApp = (options: Partial<SetupAppOptions> = {}) => {
  const activationStrategy = options.strategy;
  const storage = createInMemoryIdempotentRequestCacheStorage(options.storage);
  const specification = createTestServerSpecification();

  const app = new Hono()
    .on(
      ["POST", "PUT", "PATCH", "DELETE"],
      "/api/*",
      idempotentRequest({
        activationStrategy,
        specification,
        storage,
      }),
    )
    .post(
      "/api/hello",
      sValidator(
        "json",
        v.object({
          name: v.optional(v.string(), () => "World"),
        }),
      ),
      (c) => {
        const { name } = c.req.valid("json");
        return c.json({ message: `Hello, ${name}!` });
      },
    )
    .post("/api/trigger-error", () => {
      throw new Error("test");
    });

  return { app, specification, storage };
};

const sleep = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("idempotentRequest middleware", () => {
  describe("Happy path", () => {
    it("should process request successfully with valid Idempotency-Key", async () => {
      const { app } = setupApp();
      const idempotencyKey = uuidv4();

      const response = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "Gouki",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toStrictEqual({ message: "Hello, Gouki!" });
    });

    it("should return cached response on subsequent requests with same Idempotency-Key", async () => {
      const { app, storage } = setupApp();
      const idempotencyKey = uuidv4();
      const createSpy = vi.spyOn(storage, "create");

      const response = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "Edison",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      await sleep(100);

      const cachedResponse = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "Edison",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      expect(response.status).toEqual(cachedResponse.status);
      expect(await response.json()).toStrictEqual(await cachedResponse.json());
      expect(createSpy).toHaveBeenCalledOnce();
    });

    it("should process request with opt-in activation strategy", async () => {
      const { app, storage } = setupApp({
        strategy: "opt-in",
      });
      const createSpy = vi.spyOn(storage, "create");

      const reqWithoutKey = new Request("http://127.0.0.1:3000/api/hello", {
        body: JSON.stringify({ name: "John" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const resWithoutKey = await app.request(reqWithoutKey);
      expect(resWithoutKey.status).toBe(200);
      expect(createSpy).not.toHaveBeenCalled();

      // Idempotency-Keyありのリクエストはイデンポテント処理される
      const idempotencyKey = uuidv4();
      const reqWithKey = new Request("http://127.0.0.1:3000/api/hello", {
        body: JSON.stringify({ name: "John" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      const resWithKey = await app.request(reqWithKey);
      expect(resWithKey.status).toBe(200);

      // 同じIdempotency-Keyで再度リクエスト
      const reqWithKeySame = new Request("http://127.0.0.1:3000/api/hello", {
        body: JSON.stringify({ name: "John" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      const resWithKeySame = await app.request(reqWithKeySame);
      expect(resWithKeySame.status).toBe(200);
    });
  });

  describe("Error handling", () => {
    it("should return 400 if Idempotency-Key header is missing", async () => {
      const { app } = setupApp();

      const response = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "John",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toBe("Idempotency-Key is missing");
    });

    it("should return 400 if Idempotency-Key is invalid", async () => {
      const { app } = setupApp();

      const response = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "John",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "invalid-key",
        },
        method: "POST",
      });

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toBe(
        "Idempotency-Key format did not satisfy server-defined specifications.",
      );
    });

    it("should return 422 if Idempotency-Key is reused with different request payload", async () => {
      const { app } = setupApp();
      const idempotencyKey = uuidv4();

      const response = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "Edison",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      const response2 = await app.request("/api/hello", {
        body: JSON.stringify({
          name: "Fake Edison",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      expect(response.status).toBe(200);
      expect(response2.status).toBe(422);
      const body = await response2.text();
      expect(body).toBe("Idempotency-Key is already used");
    });

    it.fails(
      "should handle concurrent requests with same Idempotency-Key",
      async () => {
        // Simulate slow storage
        const createDelay = 200;
        const { app } = setupApp({
          storage: {
            createDelay,
          },
        });
        const idempotencyKey = uuidv4();

        const request = new Request("http://127.0.0.1:3000/api/hello", {
          body: JSON.stringify({ name: "John" }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        });
        const firstRequest = async () => app.request(request.clone());
        const secondRequest = async () => {
          // send second request before first request is stored
          await sleep(createDelay / 2);
          return app.request(request.clone());
        };

        const [successRes, conflictRes] = await Promise.all([
          firstRequest(),
          secondRequest(),
        ]);

        expect(successRes.status).toBe(200);
        // エラーハンドリング実装してないのでここ 500 になってる
        expect(conflictRes.status).toBe(409);

        const conflictBody = await conflictRes.text();
        expect(conflictBody).toBe(
          "A request is outstanding for this Idempotency-Key",
        );
      },
    );
  });
});

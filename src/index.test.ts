import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { v4 as uuidv4 } from "uuid";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";

import type { IdempotentRequestServerSpecification } from "./server-specification";
import type { IdempotentRequestStorage } from "./storage";

import { createIdempotentStorageKey } from "./brand";
import { IdempotencyKeyStorageError, UnsafeImplementationError } from "./error";
import { idempotentRequest } from "./index";
import { createInMemoryIdempotentRequestCacheStorage } from "./test/in-memory-storage";
import { createTestServerSpecification } from "./test/server-specification";

/**
 * Utility for simulating race condition
 * @param serverDelay - delay in milliseconds
 * @returns
 */
const createRacer = (
  args: Partial<{
    concurrency: number;
    totalDelayOnServer: number;
  }> = {},
) => {
  const concurrency = args.concurrency ?? 1;
  const totalWaitOnServer = args.totalDelayOnServer ?? 1000;

  const clientDelay = totalWaitOnServer / concurrency;

  const waitOnClient = async (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(void 0);
      }, clientDelay);
    });

  const waitOnServer = async (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(void 0);
      }, totalWaitOnServer);
    });

  return {
    /**
     * Await this promise when you want to make concurrent requests.
     *
     * Use this function on second or later request.
     */
    waitOnClient,
    /**
     * Await this promise when you want to simulate server delay
     */
    waitOnServer,
  };
};

const racer = createRacer({
  concurrency: 2,
  totalDelayOnServer: 1000,
});

type SetupAppArgs = {
  specification: IdempotentRequestServerSpecification;
  storage: IdempotentRequestStorage;
};

const setupApp = ({ specification, storage }: Partial<SetupAppArgs> = {}) => {
  storage ??= createInMemoryIdempotentRequestCacheStorage();
  specification ??= createTestServerSpecification();

  type HonoEnv = {
    Bindings: {
      simulateSlow: boolean;
    };
  };

  const setHonoEnv = ({
    simulateSlow,
  }: Partial<HonoEnv["Bindings"]> = {}): HonoEnv["Bindings"] => {
    const slow = simulateSlow ?? false;

    return {
      simulateSlow: slow,
    };
  };

  const app = new Hono<HonoEnv>()
    .on(
      ["POST", "PUT", "PATCH", "DELETE"],
      "/api/*",
      idempotentRequest({
        // explicitly set to always to make tests simpler
        activationStrategy: "always",
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
      async (c, next) => {
        // Simulate slow request processing and cause race condition
        if (c.env.simulateSlow === true) {
          await racer.waitOnServer();
        }
        await next();
      },
      (c) => {
        const { name } = c.req.valid("json");
        return c.json({ message: `Hello, ${name}!` });
      },
    );

  return { app, setHonoEnv, specification, storage };
};

describe("idempotentRequest middleware", () => {
  describe("Happy path", () => {
    it("should process request successfully with valid Idempotency-Key", async () => {
      const { app, setHonoEnv } = setupApp();
      const idempotencyKey = uuidv4();

      const response = await app.request(
        "/api/hello",
        {
          body: JSON.stringify({
            name: "Gouki",
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ message: "Hello, Gouki!" });
    });

    it("should return cached response on subsequent requests with same Idempotency-Key", async () => {
      const { app, setHonoEnv, storage } = setupApp();
      const idempotencyKey = uuidv4();
      const createOrFindSpy = vi.spyOn(storage, "findOrCreate");
      const createRequest = () => {
        return new Request("http://127.0.0.1:3000/api/hello", {
          body: JSON.stringify({ name: "Edison" }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        });
      };

      const response = await app.request(
        createRequest(),
        undefined,
        setHonoEnv(),
      );

      // ensure cache storage is updated
      await new Promise((resolve) => setTimeout(resolve, 50));

      const cachedResponse = await app.request(
        createRequest(),
        undefined,
        setHonoEnv(),
      );

      // 2nd request should hit cached, non-locked response
      expect(createOrFindSpy).toHaveLastReturnedWith({
        created: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        storedRequest: expect.objectContaining({
          idempotencyKey,
          lockedAt: null,
          requestMethod: "POST",
          requestPath: "/api/hello",
        }),
      });
      expect(response.status).toEqual(cachedResponse.status);
      expect(await response.json()).toStrictEqual(await cachedResponse.json());
    });
  });

  describe("Error Scenarios in Draft", () => {
    // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-2.7

    it("should return 400 if Idempotency-Key header is missing", async () => {
      const { app, setHonoEnv } = setupApp();

      const response = await app.request(
        "/api/hello",
        {
          body: JSON.stringify({
            name: "John",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({
        detail:
          "This operation is idempotent and it requires correct usage of Idempotency Key.",
        title: "Idempotency-Key is missing",
      });
    });

    it("should return 400 if Idempotency-Key does not satisfy the server specification", async () => {
      const { app, setHonoEnv, storage } = setupApp();
      const createSpy = vi.spyOn(storage, "findOrCreate");

      const response = await app.request(
        "/api/hello",
        {
          body: JSON.stringify({
            name: "John",
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "invalid-key",
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({
        detail:
          "This operation is idempotent and it requires correct usage of Idempotency Key.",
        title: "Idempotency-Key is missing",
      });
    });

    it("should return 422 if Idempotency-Key is reused with different request payload", async () => {
      const { app, setHonoEnv } = setupApp();
      const idempotencyKey = uuidv4();

      const request = new Request("http://127.0.0.1:3000/api/hello", {
        body: JSON.stringify({
          name: "Edison",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const abusedRequest = new Request(request.clone(), {
        body: JSON.stringify({
          name: "Fake Edison",
        }),
        method: "POST",
      });

      const response = await app.request(request, undefined, setHonoEnv());
      const abusedResponse = await app.request(
        abusedRequest,
        undefined,
        setHonoEnv(),
      );

      expect(response.status).toBe(200);
      expect(abusedResponse.status).toBe(422);
      expect(await abusedResponse.json()).toStrictEqual({
        detail:
          "This operation is idempotent and it requires correct usage of Idempotency Key. Idempotency Key MUST not be reused across different payloads of this operation.",
        title: "Idempotency-Key is already used",
      });
    });

    it("should handle concurrent requests with same Idempotency-Key", async () => {
      const { app, setHonoEnv } = setupApp();
      const idempotencyKey = uuidv4();

      const request = new Request("http://127.0.0.1:3000/api/hello", {
        body: JSON.stringify({ name: "John" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const firstSlowRequest = async () => {
        return app.request(
          request.clone(),
          undefined,
          setHonoEnv({
            simulateSlow: true,
          }),
        );
      };
      const secondRequest = async () => {
        // send second request before first request is stored
        await racer.waitOnClient();
        return app.request(request.clone(), undefined, setHonoEnv());
      };

      const [successRes, conflictRes] = await Promise.all([
        // run concurrently
        firstSlowRequest(),
        secondRequest(),
      ]);

      expect(successRes.status).toBe(200);
      expect(conflictRes.status).toBe(409);

      expect(await conflictRes.json()).toStrictEqual({
        detail:
          "A request with the same Idempotency-Key for the same operation is being processed or is outstanding.",
        title: "A request is outstanding for this Idempotency-Key",
      });
    });
  });

  describe("Error handling", () => {
    it("should store the error response in the cache storage", async () => {
      const { app, setHonoEnv, storage } = setupApp();
      app.post("/api/trigger-error", () => {
        throw new HTTPException(500, {
          message: "Only for testing",
        });
      });
      const setResponseAndUnlockSpy = vi.spyOn(storage, "setResponseAndUnlock");
      const idempotencyKey = uuidv4();

      const response = await app.request(
        "/api/trigger-error",
        {
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(setResponseAndUnlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey,
          requestMethod: "POST",
          requestPath: "/api/trigger-error",
        }),
        expect.objectContaining({
          body: "Only for testing",
          status: 500,
        }),
      );
      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Only for testing");
    });

    it("should wrap errors from cache storage when findOrCreate fails", async () => {
      const { app, setHonoEnv, storage } = setupApp();
      app.onError((e, c) => {
        if (e instanceof IdempotencyKeyStorageError) {
          if (e.cause instanceof Error) {
            return c.json(
              {
                cause: e.cause.message,
                detail: e.message,
                title: "Storage Error",
              },
              500,
            );
          }
          return c.json(
            {
              detail: e.message,
              title: "Storage Error",
            },
            500,
          );
        }

        return c.text("Internal Server Error", 500);
      });
      vi.spyOn(storage, "findOrCreate").mockImplementation(() => {
        throw new Error("Connection error");
      });

      const response = await app.request(
        "/api/hello",
        {
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": uuidv4(),
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toStrictEqual({
        cause: "Connection error",
        detail: "Failed to find or create the stored idempotent request",
        title: "Storage Error",
      });
    });

    it("should wrap errors from cache storage when lock fails", async () => {
      const { app, setHonoEnv, storage } = setupApp();
      app.onError((e, c) => {
        if (e instanceof IdempotencyKeyStorageError) {
          if (e.cause instanceof Error) {
            return c.json(
              {
                cause: e.cause.message,
                detail: e.message,
                title: "Storage Error",
              },
              500,
            );
          }
          return c.json(
            {
              detail: e.message,
              title: "Storage Error",
            },
            500,
          );
        }

        return c.text("Internal Server Error", 500);
      });
      vi.spyOn(storage, "lock").mockImplementation(() => {
        throw new Error("Connection error");
      });

      const response = await app.request(
        "/api/hello",
        {
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": uuidv4(),
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toStrictEqual({
        cause: "Connection error",
        detail: "Failed to lock the stored idempotent request",
        title: "Storage Error",
      });
    });

    it("should wrap errors from cache storage when setResponseAndUnlock fails", async () => {
      const { app, setHonoEnv, storage } = setupApp();
      app.onError((e, c) => {
        if (e instanceof IdempotencyKeyStorageError) {
          if (e.cause instanceof Error) {
            return c.json(
              {
                cause: e.cause.message,
                detail: e.message,
                title: "Storage Error",
              },
              500,
            );
          }
          return c.json(
            {
              detail: e.message,
              title: "Storage Error",
            },
            500,
          );
        }

        return c.text("Internal Server Error", 500);
      });
      vi.spyOn(storage, "setResponseAndUnlock").mockImplementation(() => {
        throw new Error("Connection error");
      });

      const response = await app.request(
        "/api/hello",
        {
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": uuidv4(),
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toStrictEqual({
        cause: "Connection error",
        detail:
          "Failed to save the response of an idempotent request. You should unlock the request manually.",
        title: "Storage Error",
      });
    });
  });

  describe("Unsafe implementation detection", () => {
    it("should throw an error if the storage key does not include the Idempotency-Key header", async () => {
      const { app, setHonoEnv } = setupApp({
        specification: {
          getFingerprint: () => null,
          getStorageKey: (req) => {
            const path = new URL(req.url).pathname;
            const method = req.method;
            return createIdempotentStorageKey(`${method}-${path}`);
          },
          satisfiesKeySpec: () => true,
        },
      });
      app.onError((e, c) => {
        if (e instanceof UnsafeImplementationError) {
          return c.json(
            {
              detail: e.message,
              title: "Unsafe Implementation",
            },
            500,
          );
        }
        return c.text("Internal Server Error", 500);
      });

      const response = await app.request(
        "/api/hello",
        {
          headers: {
            "Idempotency-Key": uuidv4(),
          },
          method: "POST",
        },
        setHonoEnv(),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toStrictEqual({
        detail:
          "The storage-key must include the value of the `Idempotency-Key` header.",
        title: "Unsafe Implementation",
      });
    });
  });
});

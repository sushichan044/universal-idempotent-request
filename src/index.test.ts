import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";

import idempotentRequest from "./index";
import { createTestServerSpecification } from "./server-specification/test-server";
import { createInMemoryIdempotentRequestCacheStorage } from "./storage/in-memory";

const SIMULATE_SLOW_DELAY = 1000;

const waitForRaceCondition = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(void 0);
    }, SIMULATE_SLOW_DELAY / 2);
  });

const setupApp = () => {
  const storage = createInMemoryIdempotentRequestCacheStorage();
  const specification = createTestServerSpecification();

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
          await new Promise((resolve) =>
            setTimeout(resolve, SIMULATE_SLOW_DELAY),
          );
        }
        await next();
      },
      (c) => {
        const { name } = c.req.valid("json");
        return c.json({ message: `Hello, ${name}!` });
      },
    )
    .post("/api/trigger-error", () => {
      throw new Error("test");
    });

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
      const createSpy = vi.spyOn(storage, "create");
      const request = new Request("http://127.0.0.1:3000/api/hello", {
        body: JSON.stringify({ name: "Edison" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });

      const response = await app.request(
        request.clone(),
        undefined,
        setHonoEnv(),
      );
      const cachedResponse = await app.request(
        request.clone(),
        undefined,
        setHonoEnv(),
      );

      // 2nd request should return cached response
      expect(createSpy).toHaveBeenCalledOnce();
      expect(response.status).toEqual(cachedResponse.status);
      expect(await response.json()).toStrictEqual(await cachedResponse.json());
    });
  });

  describe("Error handling", () => {
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
      expect(await response.text()).toBe("Idempotency-Key is missing");
    });

    it("should return 400 if Idempotency-Key is invalid", async () => {
      const { app, setHonoEnv } = setupApp();

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

      expect(response.status).toBe(400);
      expect(await response.text()).toBe(
        "Idempotency-Key format did not satisfy server-defined specifications.",
      );
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
      expect(await abusedResponse.text()).toBe(
        "Idempotency-Key is already used",
      );
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
        await waitForRaceCondition();
        return app.request(request.clone(), undefined, setHonoEnv());
      };

      const [successRes, conflictRes] = await Promise.all([
        // run concurrently
        firstSlowRequest(),
        secondRequest(),
      ]);

      expect(successRes.status).toBe(200);
      expect(conflictRes.status).toBe(409);

      expect(await conflictRes.text()).toBe(
        "A request is outstanding for this Idempotency-Key",
      );
    });
  });
});

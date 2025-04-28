import type {
  FrameworkTestAdapter,
  SetupAppArguments,
} from "@repo/integration-tests-utils";

import { runFrameworkIntegrationTest } from "@repo/integration-tests-utils";
import { createMiddleware } from "@universal-middleware/hono";
import { Hono } from "hono";

class HonoTestAdapter implements FrameworkTestAdapter {
  name = "Hono";

  // @ts-expect-error Initialized in resetApp
  #app: Hono;

  constructor() {
    this.resetApp();
  }

  fetch = async (request: Request): Promise<Response> => {
    // 3rd argument is required by universal-middleware/hono
    return this.#app.request(request, undefined, {});
  };

  resetApp = (): void => {
    this.#app = new Hono();
  };

  setupApp = (arguments_: SetupAppArguments): void => {
    this.#app.on(["POST", "PATCH"], "/api/*", async (c, next) => {
      const idempotentRequestMiddleware = createMiddleware(
        arguments_.universalMiddleware,
      );

      const middleware = idempotentRequestMiddleware({
        server: { specification: arguments_.serverSpecification },
        storage: { adapter: arguments_.storageAdapter },
      });

      // @ts-expect-error context types is not compatible with universal middleware
      return await middleware(c, next);
    });

    this.#app.post(
      "/api/test",
      async (c, next) => {
        if (arguments_.needSimulateSlow(c.req.raw.clone())) {
          await arguments_.racer.waitOnServer();
        }
        await next();
      },
      (c) => {
        return c.json({ message: "Test passed" });
      },
    );

    this.#app.post(
      "/api/error",
      async (c, next) => {
        if (arguments_.needSimulateSlow(c.req.raw.clone())) {
          await arguments_.racer.waitOnServer();
        }
        await next();
      },
      () => new Response("Internal Server Error", { status: 500 }),
    );
  };
}

runFrameworkIntegrationTest(new HonoTestAdapter());

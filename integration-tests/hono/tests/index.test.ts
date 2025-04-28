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
    this.#app.use("/api/*", async (c, next) => {
      const idempotentRequestMiddleware = createMiddleware(
        arguments_.idempotentRequest.middleware,
      );

      const middleware = idempotentRequestMiddleware(
        arguments_.idempotentRequest.arguments,
      );

      // @ts-expect-error context types is not compatible with universal middleware
      return await middleware(c, next);
    });

    this.#app.use(async (c, next) => {
      const raceConditionSimulatorMiddleware = createMiddleware(
        arguments_.racer.middleware,
      );

      const middleware = raceConditionSimulatorMiddleware(
        arguments_.racer.arguments,
      );

      // @ts-expect-error context types is not compatible with universal middleware
      return await middleware(c, next);
    });

    this.#app.post("/api/test", (c) => {
      return c.json({ message: "Test passed" });
    });

    this.#app.post(
      "/api/error",
      () => new Response("Internal Server Error", { status: 500 }),
    );
  };
}

runFrameworkIntegrationTest(new HonoTestAdapter());

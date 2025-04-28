import type {
  FrameworkTestAdapter,
  SetupAppArguments,
} from "@repo/integration-tests-utils";

import { runFrameworkIntegrationTest } from "@repo/integration-tests-utils";
import { createMiddleware } from "@universal-middleware/elysia";
import { Elysia } from "elysia";

class ElysiaTestAdapter implements FrameworkTestAdapter {
  name = "Elysia";

  // @ts-expect-error Initialized in resetApp
  #app: Elysia;

  constructor() {
    this.resetApp();
  }

  async fetch(request: Request): Promise<Response> {
    return await this.#app.handle(request);
  }

  resetApp = (): void => {
    this.#app = new Elysia({ aot: false });
  };

  setupApp = (arguments_: SetupAppArguments): void => {
    const idempotentRequestMiddleware = createMiddleware(
      arguments_.universalMiddleware,
    );

    const raceConditionSimulatorMiddleware = createMiddleware(
      arguments_.racer.middleware,
    );

    this.#app
      .use(
        idempotentRequestMiddleware({
          server: { specification: arguments_.serverSpecification },
          storage: { adapter: arguments_.storageAdapter },
        }),
      )
      .use(
        raceConditionSimulatorMiddleware({
          ...arguments_.racer.arguments,
        }),
      )
      .post("/api/test", () => {
        return new Response(JSON.stringify({ message: "Test passed" }), {
          status: 200,
        });
      })
      .post("/api/error", () => {
        return new Response("Internal Server Error", { status: 500 });
      });
  };
}

runFrameworkIntegrationTest(new ElysiaTestAdapter());

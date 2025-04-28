import type {
  FrameworkTestAdapter,
  SetupAppArguments,
} from "@repo/integration-tests-utils";
import type { App } from "h3";

import { runFrameworkIntegrationTest } from "@repo/integration-tests-utils";
import {
  createMiddleware,
  universalOnBeforeResponse,
} from "@universal-middleware/h3";
import { createApp, createRouter, defineEventHandler, toWebHandler } from "h3";

class H3TestAdapter implements FrameworkTestAdapter {
  name = "h3";

  // @ts-expect-error Initialized in resetApp
  #app: App;

  constructor() {
    this.resetApp();
  }

  fetch = async (request: Request): Promise<Response> => {
    const handler = toWebHandler(this.#app);
    return await handler(request);
  };

  resetApp = (): void => {
    this.#app = createApp({
      onBeforeResponse: universalOnBeforeResponse,
    });
  };

  setupApp = (arguments_: SetupAppArguments): void => {
    const router = createRouter();

    const idempotentRequestMiddleware = createMiddleware(
      arguments_.universalMiddleware,
    );

    this.#app.use(
      ["/api/test", "/api/error"],
      idempotentRequestMiddleware({
        server: { specification: arguments_.serverSpecification },
        storage: { adapter: arguments_.storageAdapter },
      }),
    );

    const raceConditionSimulatorMiddleware = createMiddleware(
      arguments_.racer.middleware,
    );

    this.#app.use(
      ["/api/test", "/api/error"],
      raceConditionSimulatorMiddleware({
        ...arguments_.racer.arguments,
      }),
    );

    router.post(
      "/api/test",
      defineEventHandler(() => {
        // we cannot use shorthand such as `return { message: "Test passed" }`
        // because the shorthand handling is overridden by the universal middleware
        // at createApp({ onBeforeResponse: universalOnBeforeResponse })
        return new Response(JSON.stringify({ message: "Test passed" }));
      }),
    );

    router.post(
      "/api/error",
      defineEventHandler(() => {
        // we cannot use shorthand such as createError("Internal Server Error")
        // because the shorthand handling is overridden by the universal middleware
        // at createApp({ onBeforeResponse: universalOnBeforeResponse })
        return new Response("Internal Server Error", {
          status: 500,
        });
      }),
    );

    this.#app.use(router);
  };
}

runFrameworkIntegrationTest(new H3TestAdapter());

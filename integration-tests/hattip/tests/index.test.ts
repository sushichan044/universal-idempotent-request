import type { Router } from "@hattip/router";
import type {
  FrameworkTestAdapter,
  SetupAppArguments,
} from "@repo/integration-tests-utils";

import { createTestClient } from "@hattip/adapter-test";
import { createRouter } from "@hattip/router";
import { runFrameworkIntegrationTest } from "@repo/integration-tests-utils";
import { createMiddleware } from "@universal-middleware/hattip";

class HattipTestAdapter implements FrameworkTestAdapter {
  name = "hattip";

  // @ts-expect-error Initialized in resetApp
  #app: Router;

  constructor() {
    this.resetApp();
  }

  fetch = async (request: Request): Promise<Response> => {
    const fetchFn = createTestClient({
      handler: this.#app.buildHandler(),
    });
    return await fetchFn(request);
  };

  resetApp = (): void => {
    this.#app = createRouter();
  };

  setupApp = (arguments_: SetupAppArguments): void => {
    const idempotentRequestMiddleware = createMiddleware(
      arguments_.idempotentRequest.middleware,
    );

    const raceConditionSimulatorMiddleware = createMiddleware(
      arguments_.racer.middleware,
    );

    this.#app.use(
      idempotentRequestMiddleware(arguments_.idempotentRequest.arguments),
    );

    this.#app.use(raceConditionSimulatorMiddleware(arguments_.racer.arguments));

    this.#app.post("/api/test", () => {
      return new Response(JSON.stringify({ message: "Test passed" }));
    });

    this.#app.post("/api/error", () => {
      return new Response("Internal Server Error", {
        status: 500,
      });
    });
  };
}

runFrameworkIntegrationTest(new HattipTestAdapter());

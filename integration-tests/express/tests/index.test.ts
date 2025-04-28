import type { SetupAppArguments } from "@repo/integration-tests-utils";
import type { Express } from "express";

import {
  type FrameworkTestAdapter,
  runFrameworkIntegrationTest,
} from "@repo/integration-tests-utils";
import { createMiddleware } from "@universal-middleware/express";
import express from "express";

class ExpressTestAdapter implements FrameworkTestAdapter {
  name = "express";

  // @ts-expect-error Initialized in resetApp
  #app: Express;

  constructor() {
    this.resetApp();
  }

  fetch = async (request: Request): Promise<Response> => {
    return this.#app(request);
  };

  resetApp = (): void => {
    this.#app = express();
  };

  setupApp = (arguments_: SetupAppArguments): void => {
    const router = express.Router();

    const idempotentRequestMiddleware = createMiddleware(
      arguments_.idempotentRequest.middleware,
    );
  };
}

runFrameworkIntegrationTest(new ExpressTestAdapter());

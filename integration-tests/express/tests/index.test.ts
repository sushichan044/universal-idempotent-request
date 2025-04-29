import type { SetupAppArguments } from "@repo/integration-tests-utils";
import type { Express } from "express";

import {
  type FrameworkTestAdapter,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  runFrameworkIntegrationTest,
} from "@repo/integration-tests-utils";
import { createMiddleware } from "@universal-middleware/express";
import express from "express";
import { toFetchResponse, toReqRes } from "fetch-to-node";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ExpressTestAdapter implements FrameworkTestAdapter {
  name = "express";

  // @ts-expect-error Initialized in resetApp
  #app: Express;

  constructor() {
    this.resetApp();
  }

  fetch = async (request: Request): Promise<Response> => {
    const { req, res } = toReqRes(request);

    this.#app(req, res);

    return await toFetchResponse(res);
  };

  resetApp = (): void => {
    this.#app = express();
  };

  setupApp = (arguments_: SetupAppArguments): void => {
    const idempotentRequestMiddleware = createMiddleware(
      arguments_.idempotentRequest.middleware,
    );

    this.#app.use(
      idempotentRequestMiddleware(arguments_.idempotentRequest.arguments),
    );

    const raceConditionSimulatorMiddleware = createMiddleware(
      arguments_.racer.middleware,
    );

    this.#app.use(raceConditionSimulatorMiddleware(arguments_.racer.arguments));

    this.#app.post("/api/test", (_, res) => {
      res.status(200).json({ message: "Test passed" });
    });

    this.#app.post("/api/error", (_, res) => {
      res.status(500).send("Internal Server Error");
    });
  };
}

// TODO: fix this
// TypeError: Cannot convert undefined or null to object
//  ❯ ServerResponse.removeHeader node:_http_outgoing:869:30
//  ❯ write ../../node_modules/.pnpm/finalhandler@2.1.0/node_modules/finalhandler/index.js:257:9
//  ❯ send ../../node_modules/.pnpm/finalhandler@2.1.0/node_modules/finalhandler/index.js:283:5
//  ❯ Immediate.<anonymous> ../../node_modules/.pnpm/finalhandler@2.1.0/node_modules/finalhandler/index.js:127:5
//  ❯ Immediate.<anonymous> ../../node_modules/.pnpm/router@2.2.0/node_modules/router/index.js:688:15
//  ❯ processImmediate node:internal/timers:493:21
// runFrameworkIntegrationTest(new ExpressTestAdapter());

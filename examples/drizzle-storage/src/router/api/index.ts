import { createMiddleware } from "@universal-middleware/hono";
import { Hono } from "hono";
import { idempotentRequestUniversalMiddleware } from "universal-idempotent-request";

import type { HonoConfig } from "../../index";

import { createSqliteDrizzleAdapter } from "../../idempotent-request/storage";
import { hashWithSha256 } from "../../utils/hash";
import { userApiRoutes } from "./user";

const apiRouter = new Hono<HonoConfig>();

apiRouter.on(["POST", "PATCH"], "*", async (c, next) => {
  const client = c.get("db");

  const idempotentRequestMiddleware = createMiddleware(
    idempotentRequestUniversalMiddleware,
  );

  const middleware = idempotentRequestMiddleware({
    hooks: {
      modifyResponse: (response, type) => {
        response.headers.set("X-Idempotency-Status", type);
        return response;
      },
    },
    server: {
      specification: {
        getFingerprint: async (request) => {
          const body = await request.text();
          return hashWithSha256(body);
        },
        getStorageKey: ({ idempotencyKey }) => {
          return idempotencyKey;
        },
        satisfiesKeySpec: () => true,
      },
    },
    storage: {
      adapter: createSqliteDrizzleAdapter(client),
    },
  });

  // @ts-expect-error typeof context is not compatible
  return await middleware(c, next);
});

export const apiRoutes = apiRouter.route("/user", userApiRoutes);

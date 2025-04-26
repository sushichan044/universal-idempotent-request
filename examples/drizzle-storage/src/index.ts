import { serve } from "@hono/node-server";
import { createMiddleware } from "@universal-middleware/hono";
import { Hono } from "hono";
import { idempotentRequestUniversalMiddleware } from "universal-idempotent-request";

import type { DB } from "./db";

import { database } from "./db";
import { createSqliteDrizzleDriver } from "./idempotent-request/storage";
import { apiRoutes } from "./router/api";
import { hashWithSha256 } from "./utils/hash";
export type HonoConfig = {
  Bindings: Record<string, never>;
  Variables: {
    db: DB;
  };
};

const app = new Hono<HonoConfig>();

app.use(async (c, next) => {
  c.set("db", database);
  await next();
});

app.on(["POST", "PUT", "PATCH"], "/api/*", async (c, next) => {
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
      driver: createSqliteDrizzleDriver(c.get("db")),
    },
  });

  // @ts-expect-error typeof context is not compatible
  return await middleware(c, next);
});

export const routes = app
  .get("/", (c) => {
    return c.json({ message: "Hello, World!" });
  })
  .route("/api", apiRoutes);

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});

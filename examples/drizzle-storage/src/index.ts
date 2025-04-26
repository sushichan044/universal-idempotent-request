import { serve } from "@hono/node-server";
import { Hono } from "hono";

import type { DB } from "./db";

import { database } from "./db";
import { apiRoutes } from "./router/api";
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

export const routes = app
  .get("/", (c) => {
    return c.json({ message: "Hello, World!" });
  })
  .route("/api", apiRoutes);

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});

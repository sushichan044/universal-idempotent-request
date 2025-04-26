import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createMiddleware } from "@universal-middleware/hono";
import { idempotentRequestUniversalMiddleware } from "universal-idempotent-request";

import type { PaymentStorage } from "./logic";

import { createPaymentStorage } from "./logic";
import { simpleSpecification } from "./spec";
import { createCloudflareKVStorageAdapter } from "./storage";

type HonoConfig = {
  Bindings: Env;
  Variables: {
    paymentStorage: PaymentStorage;
  };
};
const app = new OpenAPIHono<HonoConfig>();

app.use("*", async (c, next) => {
  c.set("paymentStorage", createPaymentStorage(c.env.DATABASE_PAYMENT));
  await next();
});

app.get("/", swaggerUI({ url: "/openapi.json" }));

app.doc("/openapi.json", {
  info: {
    title: "Simple API example of universal-idempotent-request",
    version: "1.0.0",
  },
  openapi: "3.1.0",
});

app.use("/api/*", async (c, next) => {
  const cloudflareKVAdapter = createCloudflareKVStorageAdapter(
    c.env.DATABASE_IDEMPOTENT_REQUEST,
  );

  const middlewareFactory = createMiddleware(
    idempotentRequestUniversalMiddleware,
  );

  const middleware = middlewareFactory({
    activationStrategy: (request) => {
      const path = new URL(request.url).pathname;
      return (
        path.startsWith("/api") &&
        ["PATCH", "POST", "PUT"].includes(request.method)
      );
    },
    hooks: {
      modifyResponse: (response, situation) => {
        response.headers.set("X-Idempotency-Status", situation);
        return response;
      },
    },
    server: {
      specification: simpleSpecification,
    },
    storage: {
      adapter: cloudflareKVAdapter,
    },
  });

  // @ts-expect-error - Context type is not match
  return middleware(c, next);
});

const getAccountRoute = createRoute({
  method: "get",
  path: "/api/account/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            amount: z.number(),
          }),
        },
      },
      description: "Get account successful",
    },
  },
});

app.openapi(getAccountRoute, async (c) => {
  const database = c.get("paymentStorage");
  const id = c.req.param("id");

  const amount = await database.getCurrentBalance(id);

  return c.json({ amount });
});

const depositRoute = createRoute({
  method: "post",
  path: "/api/account/{id}/deposit",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            amount: z.number(),
          }),
        },
      },
      required: true,
    },
    headers: z.object({
      "Idempotency-Key": z.string(),
    }),
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Deposit successful",
    },
  },
});

app.openapi(depositRoute, async (c) => {
  const database = c.get("paymentStorage");
  const id = c.req.param("id");
  const { amount } = c.req.valid("json");

  await database.deposit(id, amount);

  return c.json({ success: true });
});

const withdrawRoute = createRoute({
  method: "post",
  path: "/api/account/{id}/withdraw",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            amount: z.number(),
          }),
        },
      },
      required: true,
    },
    headers: z.object({
      "Idempotency-Key": z.string(),
    }),
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.null(),
            success: z.boolean().openapi({ default: true }),
          }),
        },
      },
      description: "Withdraw successful",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            success: z.boolean().openapi({ default: false }),
          }),
        },
      },
      description: "Insufficient balance",
    },
  },
});

app.openapi(withdrawRoute, async (c) => {
  const database = c.get("paymentStorage");
  const id = c.req.param("id");
  const { amount } = c.req.valid("json");

  const currentBalance = await database.getCurrentBalance(id);

  if (currentBalance < amount) {
    return c.json({ error: "Insufficient balance", success: false }, 400);
  }

  await database.withdraw(id, amount);

  return c.json({ error: null, success: true }, 200);
});

export default app;

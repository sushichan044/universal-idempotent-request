import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";

import type { HonoConfig } from "../../index";

import { createUser, getAllUsers, getUser } from "../../usecase/user";

const app = new Hono<HonoConfig>();

export const userApiRoutes = app
  .get("/", async (c) => {
    const result = await getAllUsers(c.get("db"));

    return c.json({ data: result, error: null });
  })
  .get("/:id", async (c) => {
    const { id } = c.req.param();

    const result = await getUser(c.get("db"), Number.parseInt(id));

    if (result == null) {
      return c.json({ data: null, error: "User not found" }, 404);
    }

    return c.json({ data: result, error: null });
  })
  .post(
    "/",
    sValidator(
      "json",
      v.object({ profile: v.object({ name: v.string() }) }),
      (hooks, c) => {
        if (!hooks.success) {
          return c.json({ data: null, error: hooks.error }, 400);
        }
        return;
      },
    ),
    async (c) => {
      const { profile } = c.req.valid("json");

      const user = await createUser(c.get("db"), {
        profile: {
          name: profile.name,
        },
      });

      return c.json({ data: user, error: null });
    },
  );

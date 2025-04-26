import { Hono } from "hono";

import type { HonoConfig } from "../../index";

import { userApiRoutes } from "./user";

const apiRouter = new Hono<HonoConfig>();

export const apiRoutes = apiRouter.route("/user", userApiRoutes);

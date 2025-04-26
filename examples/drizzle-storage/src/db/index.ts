import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const client = createClient({ url: "file:./local.db" });

export const database = drizzle({ client, schema });

export type DB = typeof database;

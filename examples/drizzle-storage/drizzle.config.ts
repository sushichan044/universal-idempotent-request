import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url: "file:./local.db",
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
});

import { relations, sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const TB_idempotent_request = sqliteTable("idempotent_requests", {
  id: int().primaryKey({ autoIncrement: true }),
  idempotency_key: text().notNull(),
  storage_key: text().unique().notNull(),

  request_fingerprint: text(),
  request_method: text().notNull(),
  request_path: text().notNull(),

  created_at: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  locked_at: int({ mode: "timestamp" }),

  response_body: text(),
  response_headers: text({ mode: "json" }).$type<Record<string, string>>(),
  response_status: int(),
});

export const TB_user = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
});

export const TB_user_profile = sqliteTable("user_profiles", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  user_id: int()
    .notNull()
    .references(() => TB_user.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const REL_user_relations = relations(TB_user, ({ one }) => ({
  profile: one(TB_user_profile, {
    fields: [TB_user.id],
    references: [TB_user_profile.user_id],
  }),
}));

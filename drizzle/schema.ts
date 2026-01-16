import { pgTable, index, unique, uuid, varchar, text, timestamp, serial } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	username: varchar({ length: 150 }).notNull(),
	fullName: varchar({ length: 150 }).notNull(),
	email: varchar({ length: 150 }).notNull(),
	password: text().notNull(),
	avatar: text(),
	refreshToken: text("refresh_token"),
	role: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	dummy: text(),
	dummy2: text(),
}, (table) => [
	index("idx_users_username").using("btree", sql`lower((username)::text)`),
	unique("users_email_unique").on(table.email),
]);

export const dummy = pgTable("dummy", {
	id: serial().primaryKey().notNull(),
	name: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

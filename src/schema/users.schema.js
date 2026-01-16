import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// models/user.js

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const users = pgTable(
  "users",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    username: varchar("username", { length: 150 }).notNull(),
    fullName: varchar("fullName", { length: 150 }).notNull(),
    email: varchar("email", { length: 150 }).notNull(),
    password: text("password").notNull(),
    dummy: text("dummy"),

    avatar: text("avatar"),
    refreshToken: text("refresh_token"),

    role: varchar("role", { length: 20 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("users_email_unique").on(table.email),
    index("idx_users_username").using("btree", sql`lower("username")`),
  ]
);

// Hash password (like a pre-save hook)
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Check password
async function isPasswordCorrect(input, storedPassword) {
  // console.log("inside isPasswordCorrect");
  // console.log("input password:", input);
  // console.log("stored password:", storedPassword);

  if (!input || !storedPassword) {
    throw new Error("Both input and storedPassword must be provided");
  }
  return await bcrypt.compare(input, storedPassword);
}

export {
  users,
  hashPassword,
  isPasswordCorrect,
  // generateAccessToken,
  // generateRefreshToken
};

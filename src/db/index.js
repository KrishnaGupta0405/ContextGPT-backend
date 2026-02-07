// db.js
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import * as schema from "../../drizzle/schema.ts";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const connectDB = async () => {
  try {
    const db = drizzle(pool, { schema });
    console.log("✅ Connected to PostgreSQL using Drizzle.");
    return db;
  } catch (error) {
    console.log("❌ Error connecting to database:", error);
    throw error;
  }
};

export default connectDB;

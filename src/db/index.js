// db.js
import { users } from '../schema/users.schema.js';
// import { videos } from '../schema/video.schema.js';

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
}); 

const connectDB = async () => {
  try {
    const db = drizzle(pool,  { schema: { ...users, } });
    console.log("✅ Connected to PostgreSQL using Drizzle.");
    // console.log(db);
    return db;
  } catch (error) {
    console.log("❌ Error connecting to database:", error);
    throw error;
  }
};

export default connectDB;
import "dotenv/config"; // <--- Add this line
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // host: process.env.HOST,
    // port: Number(process.env.PORT), // Make sure port is a number
    // user: process.env.USER,
    // password: process.env.PASSWORD,
    // database: process.env.DATABASE,
    // ssl: process.env.SSL === 'true', // Convert to boolean
    url: process.env.DATABASE_URL,
  },
});

// It will now correctly:

// Read your schema files

// Connect to PostgreSQL

// Create or migrate tables in the DB

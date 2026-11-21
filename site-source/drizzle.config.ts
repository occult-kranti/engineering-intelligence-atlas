import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  // Schema generation is offline. Commands that connect to MySQL still require
  // DATABASE_URL and Drizzle reports its absence before opening a connection.
  ...(connectionString ? { dbCredentials: { url: connectionString } } : {}),
});

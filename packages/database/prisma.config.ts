import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.resolve(import.meta.dirname, "../../.env") });

const configuredUrl = process.env.DATABASE_URL;
const databaseUrl =
  configuredUrl !== undefined && configuredUrl.length > 0
    ? configuredUrl
    : "postgresql://postgres:postgres@localhost:5432/platform";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});

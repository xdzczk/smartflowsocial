import "dotenv/config";
import { defineConfig } from "prisma/config";

const DATABASE_URL_FALLBACK =
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Allow `prisma generate` during CI dependency install without DB secrets.
    url: process.env.DATABASE_URL ?? DATABASE_URL_FALLBACK,
  },
});

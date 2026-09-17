import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma";

/**
 * A single Prisma client per process. Next's dev server re-evaluates modules on
 * every change, so without this the connection pool grows until SQLite locks.
 *
 * Prisma 7 connects through a driver adapter. Moving to PostgreSQL means
 * changing the provider in prisma/schema.prisma, swapping this adapter for
 * `@prisma/adapter-pg`, and pointing DATABASE_URL at the server — nothing in
 * the application code above this file changes.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mungon. Shiko .env");

  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

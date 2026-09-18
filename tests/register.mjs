import { register } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Loaded via --import before any test file.
 *
 * Tests that touch the database need DATABASE_URL, which in this project lives
 * in .env for the Prisma CLI rather than in the process environment.
 */
register("./resolver.mjs", pathToFileURL("./tests/"));

const { config } = await import("dotenv");
config({ path: ".env", quiet: true });
config({ path: ".env.local", quiet: true, override: true });

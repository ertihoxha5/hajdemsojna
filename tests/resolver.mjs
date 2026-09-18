import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Lets `node --test` load the application's own modules unchanged.
 *
 * Three things in the source only exist inside the Next bundler:
 *
 *   - `@/…` is the tsconfig path alias for `src/…`
 *   - relative imports are written extensionless (`./date`), which the bundler
 *     resolves and Node does not
 *   - `server-only` is a marker package Next supplies; it is not in
 *     node_modules, and it has no runtime behaviour worth reproducing
 *
 * Papering over these here means the tests import exactly the code that ships,
 * rather than a copy that can drift away from it.
 */

const SRC = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;
const STUB = "data:text/javascript,export {};";

/** What an extensionless specifier might actually be, in the order tried. */
const CANDIDATES = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx", "/index.js"];

/**
 * Both mean "that specifier is not a module as written". The generated Prisma
 * client is imported as a bare directory, which Node reports as the second.
 */
const RETRYABLE = new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"]);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: STUB, shortCircuit: true };
  }

  const mapped = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), SRC).href
    : specifier;

  try {
    return await nextResolve(mapped, context);
  } catch (error) {
    if (!RETRYABLE.has(error?.code)) throw error;

    // Only relative and alias specifiers get the extension search; a bare
    // package name that is genuinely missing should still fail loudly.
    const relative = mapped.startsWith(".") || mapped.startsWith("file:");
    if (!relative || path.extname(mapped)) throw error;


    for (const suffix of CANDIDATES) {
      try {
        return await nextResolve(mapped + suffix, context);
      } catch {
        // try the next candidate
      }
    }
    throw error;
  }
}

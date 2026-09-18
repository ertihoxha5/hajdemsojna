import { requireUser } from "@/lib/session";
import { handle } from "@/lib/api";
import { buildExport } from "@/server/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Everything the student has put into the app, as one JSON file.
 *
 * Served as an attachment rather than as a JSON response body so that clicking
 * the link in Cilësimet downloads a file instead of filling a browser tab.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const bundle = await buildExport(user.id);

    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="hajdemsojna-${stamp}.json"`,
        // This is the student's own data; nothing should cache it anywhere.
        "Cache-Control": "no-store, private",
      },
    });
  });
}

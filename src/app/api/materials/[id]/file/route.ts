import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { readFileFor } from "@/server/storage";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves an uploaded file — only to the user who owns it. Private material is
 * never exposed through a static path.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const material = await db.material.findFirst({
      where: { id, userId: user.id },
    });
    if (!material?.storageKey) return jsonError(ERRORS.notFound, 404, "not_found");

    const buffer = await readFileFor(material.storageKey);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": material.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(material.title)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}

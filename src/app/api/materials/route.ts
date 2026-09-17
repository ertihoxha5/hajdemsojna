import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ACCEPTED, MAX_UPLOAD_BYTES, extractText, saveFile } from "@/server/storage";
import { ERRORS, handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Uploads a study material.
 *
 * The file is stored privately, its text extracted once at upload time so AI
 * actions later are instant, and the row is tied to the uploading user.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const form = await request.formData().catch(() => null);
    if (!form) return jsonError(ERRORS.invalid, 400, "invalid_form");

    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const subjectId = String(form.get("subjectId") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return jsonError("Zgjedh një skedar për të ngarkuar.", 400, "no_file");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError("Skedari është më i madh se 12 MB.", 413, "too_large");
    }

    const kind = ACCEPTED[file.type];
    if (!kind) {
      return jsonError("Formati nuk mbështetet. Përdor PDF, TXT ose DOCX.", 415, "bad_type");
    }

    // Only attach to a subject the user owns.
    const ownedSubject = subjectId
      ? await db.subject.findFirst({ where: { id: subjectId, userId: user.id }, select: { id: true } })
      : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractText(buffer, file.type);
    const { storageKey, size } = await saveFile(user.id, file);

    const material = await db.material.create({
      data: {
        userId: user.id,
        subjectId: ownedSubject?.id ?? null,
        title: title || file.name,
        kind,
        meta: `${(size / 1024 / 1024).toFixed(1)} MB`,
        storageKey,
        mimeType: file.type,
        sizeBytes: size,
        extracted: extracted || null,
      },
    });

    return NextResponse.json({
      ok: true,
      id: material.id,
      hasText: extracted.length > 0,
    });
  });
}

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private file storage for uploaded study materials.
 *
 * Files live outside /public and are keyed per user, so nothing is reachable
 * by guessing a URL — the only way to read one is the authorised download
 * route, which checks ownership first. Swapping this for S3 means replacing
 * these three functions.
 */

const ROOT = path.join(process.cwd(), "storage");

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB

export const ACCEPTED: Record<string, "pdf" | "txt" | "dok"> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "txt",
  "application/msword": "dok",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "dok",
};

export async function saveFile(
  userId: string,
  file: File
): Promise<{ storageKey: string; size: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(ROOT, hashUser(userId));
  await mkdir(dir, { recursive: true });

  const name = `${Date.now().toString(36)}_${randomBytes(6).toString("hex")}${path.extname(file.name).slice(0, 10)}`;
  await writeFile(path.join(dir, name), buffer);

  return { storageKey: `${hashUser(userId)}/${name}`, size: buffer.length };
}

export async function readFileFor(storageKey: string): Promise<Buffer> {
  return readFile(safePath(storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  await unlink(safePath(storageKey)).catch(() => {});
}

/** Plain text for the AI to work from. Returns "" when nothing is extractable. */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return (result.text ?? "").trim();
    } catch (error) {
      console.error("[storage] pdf extraction failed", error);
      return "";
    }
  }

  if (mimeType.startsWith("text/")) {
    return buffer.toString("utf8").trim();
  }

  // .docx is a zip; without a parser the honest answer is "no text yet".
  return "";
}

function hashUser(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 24);
}

/** Refuses anything that tries to escape the storage root. */
function safePath(storageKey: string) {
  const full = path.resolve(ROOT, storageKey);
  if (!full.startsWith(path.resolve(ROOT))) {
    throw new Error("Shteg i pavlefshëm");
  }
  return full;
}

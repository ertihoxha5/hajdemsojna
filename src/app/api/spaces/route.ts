import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ERRORS, handle, jsonError } from "@/lib/api";
import { createSpaceInput } from "@/lib/spaces/validation";
import { createSpace, discover } from "@/server/spaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Everything the Mso Bashkë landing page shows. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return NextResponse.json({ ok: true, ...(await discover(user.id)) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const parsed = createSpaceInput.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? ERRORS.invalid,
        400,
        "invalid_input"
      );
    }

    const space = await createSpace(user.id, parsed.data);
    return NextResponse.json({ ok: true, space });
  });
}

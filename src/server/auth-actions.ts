"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  getSessionUser,
} from "@/lib/session";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation";

export interface AuthResult {
  ok: boolean;
  errors?: Record<string, string>;
}

/**
 * Creates the account, its settings rows, and a session — then sends the user
 * into onboarding. The password is bcrypt-hashed before it touches the
 * database and is never logged.
 */
export async function signUpAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    surname: formData.get("surname"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { name, surname, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, errors: { email: "Ky email është tashmë i regjistruar" } };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      name,
      surname,
      passwordHash,
      profile: { create: {} },
      settings: { create: {} },
      preference: { create: {} },
    },
  });

  const agent = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, agent);

  redirect("/onboarding");
}

export async function signInAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  // One message for both cases, so the form can't be used to discover which
  // addresses have accounts.
  const invalid = { ok: false, errors: { form: "Email ose fjalëkalim i pasaktë" } };

  if (!user?.passwordHash) return invalid;
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;

  const agent = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, agent);

  redirect(user.profile?.onboardedAt ? "/sot" : "/onboarding");
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

/** Used by client components that need to know who is signed in. */
export async function currentUser() {
  return getSessionUser();
}

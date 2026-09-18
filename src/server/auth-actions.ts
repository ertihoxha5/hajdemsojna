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
import {
  fieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";
import {
  clearResetTokens,
  consumeResetToken,
  purgeExpiredTokens,
  requestPasswordReset,
} from "@/lib/password-reset";
import {
  mailConfigured,
  passwordResetMail,
  sendMail,
  verifyEmailMail,
} from "@/lib/mail";
import { requestEmailVerification } from "@/lib/email-verify";
import { enforceRateLimit } from "@/lib/api";

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

  // Confirmation is sent but never waited on: an unconfirmed address is
  // allowed, so a slow or missing mail provider must not block signing up.
  try {
    const request = await requestEmailVerification(email);
    if (request) {
      const base = process.env.APP_URL ?? "http://localhost:3000";
      const link = `${base}/konfirmo?token=${encodeURIComponent(request.token)}`;
      await sendMail(verifyEmailMail(email, link, name));
    }
  } catch (error) {
    console.error("[sign-up] verification mail", error);
  }

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

/* ============================================================
   Password reset
   ============================================================ */

export interface ForgotResult extends AuthResult {
  /** True once the request has been accepted, whatever the address was. */
  submitted?: boolean;
  /** True when no mail provider is configured and the link went to the log. */
  logged?: boolean;
}

/**
 * Starts a reset.
 *
 * The answer is identical whether or not the address has an account, so this
 * form cannot be used to enumerate students. The only externally visible
 * difference is timing, and the work either way is dominated by the same
 * database lookup.
 */
export async function forgotPasswordAction(
  _prev: ForgotResult | null,
  formData: FormData
): Promise<ForgotResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { email } = parsed.data;

  // Keyed by address rather than by user: there is no session here, and the
  // address is the only stable thing an unauthenticated caller supplies.
  const limited = enforceRateLimit(`reset:${email}`, "passwordReset");
  if (limited) {
    return {
      ok: false,
      errors: { form: "Shumë kërkesa. Provo përsëri pas pak minutash." },
    };
  }

  await purgeExpiredTokens();
  const request = await requestPasswordReset(email);

  if (request) {
    const user = await db.user.findUnique({
      where: { email },
      select: { name: true },
    });

    const base = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${base}/rivendos?token=${encodeURIComponent(request.token)}`;

    try {
      await sendMail(passwordResetMail(email, link, user?.name ?? ""));
    } catch (error) {
      // A provider failure must not tell the caller the address exists.
      console.error("[forgot-password] delivery failed", error);
    }
  }

  return { ok: true, submitted: true, logged: !mailConfigured() };
}

/**
 * Finishes a reset: spends the token, writes the new password, and revokes
 * every existing session — a reset is how a student recovers a compromised
 * account, so whoever else was signed in must be signed out.
 */
export async function resetPasswordAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { token, password } = parsed.data;

  const outcome = await consumeResetToken(token);
  if (!outcome.ok) {
    return {
      ok: false,
      errors: {
        form:
          outcome.reason === "expired"
            ? "Linku ka skaduar. Kërko një link të ri."
            : "Linku nuk është valid ose është përdorur tashmë.",
      },
    };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.update({
    where: { id: outcome.userId },
    data: { passwordHash },
    select: { email: true, profile: { select: { onboardedAt: true } } },
  });

  // Every session, including any the attacker holds. The new one below is
  // created afterwards, so the student stays signed in on this device.
  await db.session.deleteMany({ where: { userId: outcome.userId } });
  await clearResetTokens(user.email);

  const agent = (await headers()).get("user-agent") ?? undefined;
  await createSession(outcome.userId, agent);

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

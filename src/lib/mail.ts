import "server-only";

/**
 * Outgoing email.
 *
 * There is no mail provider wired up, and in the spirit of the rest of this
 * codebase nothing here pretends otherwise. `sendMail` reports honestly which
 * of two things happened:
 *
 *   - "sent"   — a provider is configured and accepted the message
 *   - "logged" — no provider, so the message was written to the server log
 *
 * The caller passes that outcome to the UI, which tells the student the truth:
 * in development the reset link is on the console, not in their inbox.
 *
 * Adding a real provider means implementing `deliver` below. Nothing else in
 * the application changes.
 */

export interface Mail {
  to: string;
  subject: string;
  /** Plain text. Every message this app sends is short enough not to need HTML. */
  text: string;
}

export type MailOutcome = "sent" | "logged";

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<MailOutcome> {
  if (!mailConfigured()) {
    // Not an error: this is the documented development path.
    console.info(
      [
        "",
        "─── email (no provider configured, not sent) ───",
        `To:      ${mail.to}`,
        `Subject: ${mail.subject}`,
        "",
        mail.text,
        "───────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return "logged";
  }

  await deliver(mail);
  return "sent";
}

/**
 * Resend is used because it needs no SMTP configuration and no extra
 * dependency — it is a single authenticated POST.
 */
async function deliver(mail: Mail): Promise<void> {
  const from = process.env.MAIL_FROM ?? "Hajde Msojna <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!response.ok) {
    // The body can contain the recipient address, so it is not logged verbatim.
    throw new Error(`Email provider refused the message (${response.status})`);
  }
}

/** Messages this app sends. */
export function passwordResetMail(to: string, link: string, name: string): Mail {
  return {
    to,
    subject: "Rivendos fjalëkalimin — Hajde Msojna",
    text: [
      `Përshëndetje ${name},`,
      "",
      "Kërkove të rivendosësh fjalëkalimin tënd. Hap këtë link:",
      "",
      link,
      "",
      "Linku skadon pas një ore dhe mund të përdoret vetëm një herë.",
      "",
      "Nëse nuk e ke kërkuar ti, injoroje këtë email — fjalëkalimi yt nuk ndryshon.",
      "",
      "— Hajde Msojna",
    ].join("\n"),
  };
}

export function verifyEmailMail(to: string, link: string, name: string): Mail {
  return {
    to,
    subject: "Konfirmo email-in — Hajde Msojna",
    text: [
      `Mirë se erdhe, ${name}!`,
      "",
      "Konfirmoje adresën tënde që të mos humbasësh njoftimet për afate dhe provime:",
      "",
      link,
      "",
      "Linku vlen dy ditë. Mund ta përdorësh aplikacionin edhe pa e konfirmuar.",
      "",
      "— Hajde Msojna",
    ].join("\n"),
  };
}

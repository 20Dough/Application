// Glue between auth tokens and email delivery for the verification and
// password-reset flows. Server-side only.

import { createAuthToken } from "@/lib/auth/tokens";
import { sendEmail, appUrl } from "@/lib/email/send";
import { verificationEmail, passwordResetEmail } from "@/lib/email/templates";

export async function sendVerificationEmail(userId: string, email: string) {
  const token = await createAuthToken(userId, "verify_email");
  await sendEmail(
    verificationEmail(email, `${appUrl()}/verify-email?token=${token}`),
  );
}

export async function sendPasswordResetEmail(userId: string, email: string) {
  const token = await createAuthToken(userId, "password_reset");
  await sendEmail(
    passwordResetEmail(email, `${appUrl()}/reset-password?token=${token}`),
  );
}

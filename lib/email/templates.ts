// Email content builders. Plain, dependency-free HTML + a text fallback.

import type { EmailMessage } from "@/lib/email/send";

function layout(
  heading: string,
  body: string,
  cta: { url: string; label: string },
) {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#1f2328">🐝 ${heading}</h2>
    <p style="color:#57606a;line-height:1.5">${body}</p>
    <p><a href="${cta.url}" style="display:inline-block;background:#f5a623;color:#000;
      padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${cta.label}</a></p>
    <p style="color:#8b949e;font-size:12px">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>
  </div>`;
}

export function verificationEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Verify your HiveMind email",
    html: layout(
      "Confirm your email",
      "Welcome to HiveMind! Confirm your email address to finish setting up your account.",
      { url, label: "Verify email" },
    ),
    text: `Welcome to HiveMind! Verify your email: ${url}`,
  };
}

export function passwordResetEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset your HiveMind password",
    html: layout(
      "Reset your password",
      "We received a request to reset your password. This link expires in 1 hour. If you didn't request it, you can ignore this email.",
      { url, label: "Reset password" },
    ),
    text: `Reset your HiveMind password (expires in 1 hour): ${url}`,
  };
}

export function invitationEmail(
  to: string,
  workspaceName: string,
  url: string,
): EmailMessage {
  return {
    to,
    subject: `You're invited to ${workspaceName} on HiveMind`,
    html: layout(
      `Join ${workspaceName}`,
      `You've been invited to collaborate in the “${workspaceName}” workspace on HiveMind, where human and AI teammates work together.`,
      { url, label: "Open HiveMind" },
    ),
    text: `You're invited to ${workspaceName} on HiveMind: ${url}`,
  };
}

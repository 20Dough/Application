import { avatarColor, avatarInitials, isImageAvatar } from "@/lib/agents/profile";

// AgentAvatar — renders an agent's avatar consistently across the UI.
//
// The avatarUrl field is flexible: it may be an image URL, an emoji/glyph, or
// empty. We render an image when it looks like a URL, the raw glyph when it is
// short text/emoji, and deterministic colored initials as the fallback.

export function AgentAvatar({
  displayName,
  avatarUrl,
  size = "md",
}: {
  displayName: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions =
    size === "lg" ? "h-12 w-12 text-xl" : size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  const trimmed = avatarUrl?.trim();

  if (isImageAvatar(trimmed)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={trimmed}
        alt={displayName}
        className={`${dimensions} shrink-0 rounded-full border border-neutral-700 object-cover`}
      />
    );
  }

  // Emoji / short glyph avatar.
  if (trimmed) {
    return (
      <span
        aria-hidden
        className={`${dimensions} flex shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800`}
      >
        {trimmed}
      </span>
    );
  }

  // Initials fallback with a stable accent color derived from the name.
  return (
    <span
      aria-hidden
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(
        displayName
      )}`}
    >
      {avatarInitials(displayName)}
    </span>
  );
}

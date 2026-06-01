import type { ProviderName } from "@/types";

/** Join class names, skipping falsy values. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Format an ISO timestamp as a short HH:MM time. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Two-letter initials from a name, for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Brand color for an AI provider, used on agent avatars/badges. */
export function providerColor(provider: ProviderName): string {
  switch (provider) {
    case "openai":
      return "#10a37f";
    case "anthropic":
      return "#d97757";
    case "gemini":
      return "#4285f4";
    default:
      return "#8b949e";
  }
}

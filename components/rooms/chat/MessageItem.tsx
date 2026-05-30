import {
  avatarColor,
  avatarInitials,
  isImageAvatar,
} from "@/lib/agents/profile";
import { modelLabel, providerLabel } from "@/lib/agents/registry";
import { parseMetadata, type ChatMessage } from "./types";

// MessageItem — renders a single chat message: the sender's avatar and name, a
// timestamp, and the message body. Three sender kinds are supported:
//
//   human  — a workspace member (the only kind posted in this phase)
//   agent  — an AI teammate (rendered for completeness; not yet generated)
//   system — room/system notices, shown centered and muted
//
// `isOwn` highlights the current viewer's own messages.

// Formats a timestamp as a short clock time (e.g. "3:42 PM"); the full date/time
// is exposed via the title attribute on hover.
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatFull(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

// Small avatar shared by human/agent senders: an image when avatarUrl looks like
// a URL, a raw glyph for emoji/short text, or deterministic colored initials.
function SenderAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const trimmed = avatarUrl?.trim();
  const dimensions = "h-8 w-8 text-xs";

  if (isImageAvatar(trimmed)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={trimmed}
        alt={name}
        className={`${dimensions} shrink-0 rounded-full border border-neutral-700 object-cover`}
      />
    );
  }
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
  return (
    <span
      aria-hidden
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(
        name
      )}`}
    >
      {avatarInitials(name)}
    </span>
  );
}

export function MessageItem({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  // System messages are rendered as a centered, muted notice.
  if (message.senderType === "system") {
    return (
      <li className="flex justify-center">
        <span
          className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-500"
          title={formatFull(message.createdAt)}
        >
          {message.content}
        </span>
      </li>
    );
  }

  const isAgent = message.senderType === "agent";
  const name = isAgent
    ? message.agent?.displayName ?? "Agent"
    : message.user?.name || message.user?.email || "Unknown";
  const avatarUrl = isAgent
    ? message.agent?.avatarUrl ?? null
    : message.user?.avatarUrl ?? null;

  // For AI messages, surface the provider/model the response came from.
  const meta = isAgent ? parseMetadata(message.metadata) : null;
  const modelText =
    meta?.provider && meta?.model
      ? `${providerLabel(meta.provider)} · ${modelLabel(meta.provider, meta.model)}`
      : null;

  return (
    <li className="flex gap-3">
      <SenderAvatar name={name} avatarUrl={avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-neutral-100">
            {name}
          </span>
          {isAgent && (
            <span className="shrink-0 rounded-full border border-violet-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
              AI
            </span>
          )}
          {isOwn && !isAgent && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-600">
              You
            </span>
          )}
          <span
            className="shrink-0 text-xs text-neutral-600"
            title={formatFull(message.createdAt)}
          >
            {formatTime(message.createdAt)}
          </span>
          {modelText && (
            <span className="shrink-0 truncate text-[10px] text-neutral-600">
              {modelText}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-neutral-300">
          {message.content}
        </p>
      </div>
    </li>
  );
}

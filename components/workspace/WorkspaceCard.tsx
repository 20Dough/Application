import Link from "next/link";

// WorkspaceCard — a single workspace shown on the dashboard.
// Presentational only; links through to the workspace detail page.

export type WorkspaceCardData = {
  id: string;
  name: string;
  description?: string | null;
  role: string;
  memberCount?: number;
};

export function WorkspaceCard({ workspace }: { workspace: WorkspaceCardData }) {
  return (
    <Link
      href={`/workspace/${workspace.id}`}
      className="group flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-600"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-neutral-100 group-hover:text-white">
          {workspace.name}
        </h3>
        <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-xs capitalize text-neutral-400">
          {workspace.role}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-neutral-400">
        {workspace.description || "No description"}
      </p>
      {typeof workspace.memberCount === "number" && (
        <span className="mt-4 text-xs text-neutral-600">
          {workspace.memberCount}{" "}
          {workspace.memberCount === 1 ? "member" : "members"}
        </span>
      )}
    </Link>
  );
}

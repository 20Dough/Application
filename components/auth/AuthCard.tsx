import Link from "next/link";

/** Shared centered card used by the auth-related standalone pages. */
export function AuthCard({
  title,
  children,
  showHome = true,
}: {
  title: string;
  children: React.ReactNode;
  showHome?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hive-bg p-6">
      <div className="w-full max-w-sm rounded-lg border border-hive-border bg-hive-panel p-6 text-center">
        <div className="mb-1 text-3xl">🐝</div>
        <h1 className="mb-4 text-lg font-semibold text-hive-text">{title}</h1>
        {children}
        {showHome && (
          <Link
            href="/"
            className="mt-4 inline-block text-xs text-hive-accent hover:underline"
          >
            Go to HiveMind →
          </Link>
        )}
      </div>
    </div>
  );
}

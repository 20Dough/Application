export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">HiveMind</h1>
      <p className="max-w-md text-center text-neutral-400">
        Phase 1 foundation is ready. Providers ARi (OpenAI) and Cloudy
        (Anthropic) will join the hive next.
      </p>
      <div className="flex gap-4 text-sm text-neutral-500">
        <span className="rounded-full border border-neutral-700 px-3 py-1">
          ARi · OpenAI
        </span>
        <span className="rounded-full border border-neutral-700 px-3 py-1">
          Cloudy · Anthropic
        </span>
      </div>
    </main>
  );
}

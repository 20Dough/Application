// Next.js instrumentation — runs once when the server starts. We use it to
// validate required environment variables early (fail fast on misconfig).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("@/lib/env");
    validateServerEnv();
  }
}

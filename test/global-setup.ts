import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, rmSync } from "node:fs";

// Create a fresh test database with the current schema once, before any tests.
export default function setup() {
  const testDbPath = fileURLToPath(
    new URL("./../prisma/test.db", import.meta.url),
  );
  const url = `file:${testDbPath}`;

  // Start from a clean slate so each run is deterministic.
  if (existsSync(testDbPath)) rmSync(testDbPath);

  // The db file was just removed, so this creates it fresh (no data-loss prompt).
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}

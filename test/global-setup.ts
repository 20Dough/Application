import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./db-url";

// Apply all migrations to the test database once, before any tests run.
// Idempotent: a fresh DB gets the full schema; an existing one is a no-op.
// Per-test data is cleared by the truncation in test/setup.ts.
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

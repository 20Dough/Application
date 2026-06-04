import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run against a dedicated SQLite database (never the dev db). The path is
// absolute so both the Prisma CLI (schema push in globalSetup) and the Prisma
// client (in the tests) resolve to the same file regardless of cwd.
const testDbPath = fileURLToPath(new URL("./prisma/test.db", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    globalSetup: "./test/global-setup.ts",
    setupFiles: ["./test/setup.ts"],
    // All suites share one SQLite test database, so run files serially to avoid
    // one file's per-test truncation clobbering another's data.
    fileParallelism: false,
    env: {
      DATABASE_URL: `file:${testDbPath}`,
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});

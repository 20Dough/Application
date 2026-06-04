import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL } from "./test/db-url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    globalSetup: "./test/global-setup.ts",
    setupFiles: ["./test/setup.ts"],
    // All suites share one Postgres test database, so run files serially to
    // avoid one file's per-test truncation clobbering another's data.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});

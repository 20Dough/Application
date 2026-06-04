// Resolve the database URL the test suite runs against. CI sets
// TEST_DATABASE_URL (or DATABASE_URL) to its Postgres service; locally it
// defaults to the `hivemind_test` database from docker-compose.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/hivemind_test?schema=public";

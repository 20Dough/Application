// In-memory stand-in for Next's cookie store, used to mock `next/headers` in
// tests so session create/read/delete works without a real request context.

const jar = new Map<string, string>();

export const cookieStore = {
  get(name: string) {
    return jar.has(name) ? { name, value: jar.get(name)! } : undefined;
  },
  set(name: string, value: string) {
    jar.set(name, value);
  },
  delete(name: string) {
    jar.delete(name);
  },
  /** Test helper: wipe all cookies between tests. */
  __reset() {
    jar.clear();
  },
};

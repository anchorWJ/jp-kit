import { defineConfig } from "vitest/config";

// A local config so this example is not swept into the repository's own test
// run: the naive adapter is meant to fail.
export default defineConfig({
  test: {
    include: ["japanready.test.ts"],
    environment: "node",
  },
});

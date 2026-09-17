import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@japanready/core": r("./packages/core/src/index.ts"),
      "@japanready/testkit": r("./packages/testkit/src/index.ts"),
    },
  },
});

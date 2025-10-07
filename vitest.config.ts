import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: __dirname,
    include: ["api/**/*.test.ts", "api/**/__tests__/**/*.test.ts"],
    environment: "node",
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});

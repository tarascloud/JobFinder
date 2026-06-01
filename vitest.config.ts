import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    server: {
      deps: {
        // Allow vitest to process next/next-auth CJS packages
        fallbackCJS: true,
        // Inline next-auth so vitest can intercept its imports
        inline: ["next-auth", "next"],
      },
    },
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
});

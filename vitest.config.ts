import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Modul server memakai "server-only"; di unit test diganti modul kosong.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: process.env.INTEGRATION ? ["tests/integration/**/*.test.ts"] : ["tests/*.test.ts"],
    fileParallelism: !process.env.INTEGRATION,
    testTimeout: 30_000,
  },
});

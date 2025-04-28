import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      all: true,
      exclude: ["examples/**"],
      include: ["**/src/**", "**/tests/**"],
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
    reporters:
      process.env["GITHUB_ACTIONS"] == null
        ? "default"
        : ["default", "github-actions"],
    workspace: ["./src", "integration-tests/*"],
  },
});

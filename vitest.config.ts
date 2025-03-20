import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**"],
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
    reporters:
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      process.env["GITHUB_ACTIONS"] == null
        ? "default"
        : ["default", "github-actions"],
  },
});

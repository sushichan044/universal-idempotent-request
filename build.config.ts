import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  entries: ["src/index.ts", "src/brand/index.ts"],
  outDir: "dist",
});

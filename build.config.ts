import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  clean: true,
  declaration: true,
  entries: [
    "src/index.ts",
    "src/server-specification/index.ts",
    "src/storage/index.ts",
  ],
  outDir: "dist",
  rollup: {
    esbuild: {
      minifySyntax: true,
    },
  },
});

import ts from "@virtual-live-lab/eslint-config/presets/ts";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ts,
  {
    extends: [eslintPluginUnicorn.configs.recommended],
    languageOptions: {
      globals: globals.builtin,
    },
    name: "@repo/eslint-config/unicorn",
    rules: {
      "unicorn/custom-error-definition": "error",
      "unicorn/filename-case": "off",
      "unicorn/no-null": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "unicorn/prevent-abbreviations": "off",
    },
  },
);

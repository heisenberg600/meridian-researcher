import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  globalIgnores([
    ".next/**",
    "build/**",
    "dist/**",
    "convex/_generated/**",
    "node_modules/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
]);

export default eslintConfig;

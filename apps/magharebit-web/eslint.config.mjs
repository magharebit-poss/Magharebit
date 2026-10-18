import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // App Router layout IS the correct place for fonts — this rule targets Pages Router
      "@next/next/no-page-custom-font": "off",
      // FileReader data-URL previews cannot use next/image (no domain/path to optimize)
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;

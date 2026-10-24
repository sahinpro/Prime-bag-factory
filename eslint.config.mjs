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
    files: [
      "src/components/site/**/*.{ts,tsx}",
      // Brackets are a glob character class; escape so this is the locale segment.
      "src/app/\\[locale\\]/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Public pages use Hugeicons through @/components/site/icon. lucide-react stays on the admin kit and shadcn primitives.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

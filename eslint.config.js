import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        }
      ],
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
      react: {
        version: "detect",
      },
    },
  },
  // JS/Node scripts config
  {
    files: ["**/*.{js,cjs,mjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^__dirname$",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Allow require() in JS scripts
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  prettierConfig,
  {
    ignores: [
      "**/dist/*",
      "**/build/*",
      "**/.turbo/*",
      "**/node_modules/*",
      "packages/vscode-ide-companion/src/out/*",
      "packages/vscode-ide-companion/dist/*",
      "packages/cli/lib/*",
      "packages/core/lib/*",
      "packages/types/lib/*",
      "integration-tests/lib/*",
      "eslint.config.js",
      "**/coverage/*",
    ],
  },
];
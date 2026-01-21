import js from "@eslint/js";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "eslint.config.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
];

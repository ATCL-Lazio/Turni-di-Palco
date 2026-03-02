const eslint = require("@eslint/js");

module.exports = [
  // Ignore most files at root level, only lint specific files that need it
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/cert/**",
      "**/temp/**",
      "apps/**",
      "reactbricks/**",
      "supabase/**",
      "tools/**",
      "shared/**",
      "assets/**",
      "docs/**",
      ".github/**"
    ]
  },
  // Basic config for any JS/TS files at root level
  {
    files: ["**/*.js", "**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly"
      }
    },
    rules: {
      ...eslint.configs.recommended.rules
    }
  }
];

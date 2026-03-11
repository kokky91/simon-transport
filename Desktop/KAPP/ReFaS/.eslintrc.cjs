module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["import"],
  settings: {
    "import/resolver": {
      typescript: {}
    }
  },
  overrides: [
    {
      files: ["infrastructure/loadtest/**/*.js"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      env: {
        es2022: true
      }
    },
    {
      files: ["**/*.{ts,tsx}"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      rules: {
        "import/no-restricted-paths": [
          "error",
          {
            zones: [
              {
                target: "./apps",
                from: "./services",
                message: "Apps may not import services directly."
              },
              {
                target: "./services",
                from: "./apps",
                message: "Services may not import apps."
              }
            ]
          }
        ]
      }
    },
    {
      files: ["services/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["apps/*", "services/*"],
                message: "Services may only share code through @contracts or @shared aliases."
              }
            ]
          }
        ]
      }
    }
  ]
};

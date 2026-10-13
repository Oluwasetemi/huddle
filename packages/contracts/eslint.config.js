import setemiojo from "@setemiojo/eslint-config";

export default setemiojo(
  {
    type: "lib",
    typescript: true,
    formatters: true,
    stylistic: {
      indent: 2,
      semi: true,
      quotes: "double",
    },
  },
  {
    rules: {
      "ts/consistent-type-definitions": ["error", "type"],
      "perfectionist/sort-imports": [
        "error",
        {
          tsconfig: { rootDir: "." },
        },
      ],
    },
  },
);

import { defineConfig } from "vize";

export default defineConfig({
  linter: {
    enabled: true,
    preset: "happy-path",
    rules: {
      "vue/prop-name-casing": "off",
      "vue/attribute-hyphenation": "off",
    },
  },
  typeChecker: {
    enabled: true,
    strict: false,
    checkProps: true,
    checkEmits: true,
    checkTemplateBindings: true,
    checkReactivity: true,
    checkSetupContext: true,
    checkInvalidExports: true,
    checkFallthroughAttrs: true,
  },
});

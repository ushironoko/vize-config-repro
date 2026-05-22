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
    checkProps: false,
    checkEmits: false,
    checkTemplateBindings: false,
    checkReactivity: false,
    checkSetupContext: false,
    checkInvalidExports: false,
    checkFallthroughAttrs: false,
  },
});

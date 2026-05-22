# vize-config-repro

Minimal reproduction for `vize.config.ts` settings being ignored by `vize lint` and `vize check` CLI in vize `0.114.0`.

## Environment

- vize `0.114.0` (npm)
- @typescript/native-preview `7.0.0-dev.20260522.1`
- pnpm `11.0.9`
- Node `>=22`
- darwin / arm64 (other platforms not tested)

## Setup

```bash
pnpm install --config.minimumReleaseAge=0
```

`minimumReleaseAge` override is only needed if pnpm's freshness policy is active in your environment.

## Repro 1 — `linter.rules` is ignored by `vize lint`

`apps/app/vize.config.ts` sets:

```ts
linter: {
  preset: "happy-path",
  rules: {
    "vue/prop-name-casing": "off",
    "vue/attribute-hyphenation": "off",
  },
}
```

Run:

```bash
pnpm --filter app lint:vize
```

### Expected

`0 warnings` (both rules are set to `off`).

### Actual

```
[vize:vue/prop-name-casing] Prop 'countTotal' should be 'count-total' (kebab-case)
[vize:vue/attribute-hyphenation] Attribute should be hyphenated

2 warnings in 2 files
```

The CLI loads neither `vize.config.ts` nor `vize.config.json`. `vize lint --help` lists `--config` as "not yet implemented".

Auto-discovery and explicit `-c vize.config.ts` produce identical results.

## Repro 2 — `typeChecker.*` toggles and `--no-check-*` flags do not suppress TS diagnostics

`apps/app/vize.config.ts` sets every `typeChecker.check*` to `false`:

```ts
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
}
```

Run:

```bash
pnpm --filter app typecheck:vize
```

### Expected

`No type errors found!` (all Vue-specific checks disabled, and the only diagnostic in the project is a prop type mismatch).

### Actual

```
src/Parent.vue
  error:8:18 [TS2322] Type 'string' is not assignable to type 'number'.

1 error(s)
```

Same diagnostic appears when running with CLI flags instead:

```bash
pnpm exec vize check "src/**/*.vue" \
  --tsconfig tsconfig.json \
  --no-check-props \
  --no-check-template-bindings
```

Either:

- `typeChecker.*` settings are not read from the config, **and** the matching CLI flags are not wired through to the underlying virtual-TS pipeline, or
- the option names suggest they control prop / template-binding type checking but actually only gate additional Vue-specific lint-style checks, leaving the base TS diagnostics unaffected.

Either way the documented behavior in <https://vizejs.dev/guide/configuration/index.html> does not match observed behavior.

## Source

- `apps/app/vize.config.ts` — config that should be honored
- `apps/app/src/Child.vue` — component with `defineProps<{ countTotal: number }>()`
- `apps/app/src/Parent.vue` — passes `:countTotal="wrong"` where `wrong: string`
- `apps/app/package.json` — `lint:vize` / `typecheck:vize` scripts

## Other issues observed in a larger codebase but not reproduced here

The following symptoms were observed in a private pnpm workspace and did **not** reproduce in this minimal repo. Listed for upstream awareness only.

### A. `--corsa-path` / `CORSA_PATH` ignored by `vize check`

Symptom: explicit `--corsa-path /path/to/tsgo` or `CORSA_PATH=/path/to/tsgo` is reported by `vize check` as "@typescript/native-preview not installed", even though the binary exists at the given path.

Suspected location: `crates/vize_canon/src/batch/executor.rs::CorsaExecutor::new` (project-session client honors `corsa_path` but the batch path does not).

### B. `@typescript/native-preview` at workspace root not detected from a workspace child

Symptom: in a pnpm monorepo where only the workspace root depends on `@typescript/native-preview`, running `vize check` from a child app fails with the "not installed" error. Adding `@typescript/native-preview-<platform>` directly to the child app works around it.

Suspected location: `crates/vize_canon/src/lsp_client/paths.rs::find_corsa_in_search_roots` boundary-checks at `project_root`, so a hoisted dependency above `project_root` is unreachable.

This minimal repo installs `@typescript/native-preview` at the workspace root, and the binary _is_ found, so the bug only surfaces in some workspace layouts. The exact trigger is still under investigation.

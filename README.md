# vize-config-repro

Minimal reproduction for four issues in vize `0.114.0` CLI:

1. `vize lint` ignores `linter.rules` in `vize.config.{ts,json}`
2. `vize check` does not suppress base TS diagnostics via `typeChecker.*` or `--no-check-*` flags
3. `vize check` ignores `--corsa-path` / `CORSA_PATH`
4. `vize check` cannot locate `tsgo` when a pnpm workspace child has `@typescript/native-preview` but no platform-specific binary in its local `node_modules`

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

The default state of this repo reproduces all four issues. No additional setup is required.

---

## Repro 1 — `vize lint` ignores `linter.rules`

`apps/app/vize.config.ts`:

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

`0 warnings` — both rules are set to `off`.

### Actual

```
[vize:vue/prop-name-casing] Prop 'countTotal' should be 'count-total' (kebab-case)
[vize:vue/attribute-hyphenation] Attribute should be hyphenated

2 warnings in 2 files
```

`vize lint --help` lists `--config` as "not yet implemented". Auto-discovery and explicit `-c vize.config.ts` produce identical results.

---

## Repro 2 — `vize check` does not suppress diagnostics via `typeChecker.*` or `--no-check-*`

`apps/app/vize.config.ts` disables every Vue-specific check:

```ts
typeChecker: {
  enabled: true,
  checkProps: false,
  checkEmits: false,
  checkTemplateBindings: false,
  checkReactivity: false,
  checkSetupContext: false,
  checkInvalidExports: false,
  checkFallthroughAttrs: false,
}
```

Run (requires Repro 4 to be worked around first — see below):

```bash
pnpm --filter app typecheck:vize
```

### Expected

`No type errors found!` if `checkProps`/`checkTemplateBindings` actually gate the diagnostic, or at least the same behavior whether the option is `true` or `false`.

### Actual

```
src/Parent.vue
  error:8:18 [TS2322] Type 'string' is not assignable to type 'number'.

1 error(s)
```

Same diagnostic appears with CLI flags:

```bash
pnpm --filter app exec vize check "src/**/*.vue" \
  --tsconfig tsconfig.json \
  --no-check-props \
  --no-check-template-bindings
```

The `typeChecker.*` settings and `--no-check-*` flags do not change output. Either they are not read, or the option names suggest they control prop / template-binding type checking but only gate extra Vue-specific checks while leaving base TS diagnostics unaffected. <https://vizejs.dev/guide/configuration/index.html> describes the settings without that caveat.

---

## Repro 3 — `vize check` ignores `--corsa-path` and `CORSA_PATH`

This repro relies on Repro 4's setup (workspace child has incomplete `native-preview`).

The platform binary actually exists at:

```
node_modules/.pnpm/@typescript+native-preview-darwin-arm64@<ver>/node_modules/@typescript/native-preview-darwin-arm64/lib/tsgo
```

Pass it explicitly:

```bash
TSGO=$(find node_modules/.pnpm -name tsgo -path "*native-preview-darwin-arm64*" | head -1)
pnpm --filter app exec vize check "src/**/*.vue" \
  --tsconfig tsconfig.json \
  --corsa-path "$TSGO"
```

### Expected

vize check uses the binary at `$TSGO` and runs to completion.

### Actual

```
vize check requires '@typescript/native-preview' to be installed.
```

Same when using `CORSA_PATH=$TSGO pnpm --filter app typecheck:vize`. The `--corsa-path` flag is parsed but not threaded into `CorsaExecutor::new` (see `crates/vize_canon/src/batch/executor.rs`). Only the project-session client honors it.

(The legacy `--tsgo-path` flag has been removed in `0.114.0`; the help even suggests `--corsa-path` instead, yet `--corsa-path` itself does not work for the batch path.)

---

## Repro 4 — `vize check` fails when only the workspace child has `@typescript/native-preview`

`apps/app/package.json` depends on `@typescript/native-preview`. pnpm installs the bare entry locally:

```
apps/app/node_modules/@typescript/native-preview/lib/
├── getExePath.d.ts
└── getExePath.js          # no tsgo binary here
```

The platform-specific binary lives only at the workspace root:

```
node_modules/.pnpm/@typescript+native-preview-darwin-arm64@<ver>/node_modules/@typescript/native-preview-darwin-arm64/lib/tsgo
```

Run:

```bash
pnpm --filter app typecheck:vize
```

### Expected

vize check climbs up from `apps/app` to the workspace root, finds the platform binary in `node_modules/.pnpm/...`, and runs.

### Actual

```
vize check requires '@typescript/native-preview' to be installed.
```

The error is misleading — `@typescript/native-preview` _is_ installed; `@typescript/native-preview-darwin-arm64` (the platform binary host) is just not hoisted into `apps/app/node_modules`.

`crates/vize_canon/src/lsp_client/paths.rs::find_corsa_in_search_roots` boundary-checks at `project_root`, so a hoisted dependency above the app directory is unreachable.

### Workaround

Add the platform binary to the workspace child:

```bash
pnpm --filter app add -D @typescript/native-preview-darwin-arm64 --config.minimumReleaseAge=0
```

After this, `pnpm --filter app typecheck:vize` runs successfully — and then Repro 2 becomes observable on the same diagnostic.

---

## File layout

- `apps/app/vize.config.ts` — config that should be honored
- `apps/app/src/Child.vue` — `defineProps<{ countTotal: number }>()`
- `apps/app/src/Parent.vue` — passes `:countTotal="wrong"` where `wrong: string`
- `apps/app/package.json` — `lint:vize` / `typecheck:vize` scripts, depends only on `@typescript/native-preview` (no `-<platform>` entry)

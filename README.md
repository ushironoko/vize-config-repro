# vize-config-repro

Minimal reproduction repo for issues observed in the vize CLI (`vize lint` / `vize check`).

## Current issue (v0.124.0) — Options API SFC generates invalid virtual TS

`vize check` generates invalid TypeScript when a Vue SFC uses Options API style
(`<script lang="ts">` + `export default defineComponent({ ... })`), causing TS1128
parse errors that cannot be silenced by any user-side configuration.

See [Repro 5](#repro-5--vize-check-strips-the-export-keyword-when-generating-virtual-ts-for-options-api-sfc) below.

## Historical issues (v0.114.0, all FIXED in v0.124.0)

1. `vize lint` ignored `linter.rules` — **FIXED**
2. `vize check` did not suppress base TS diagnostics via `typeChecker.*` — **FIXED**
3. `vize check` ignored `--corsa-path` / `CORSA_PATH` — **FIXED**
4. `vize check` could not locate `tsgo` when only the workspace root had
   `@typescript/native-preview` — **FIXED**

The reproduction file layout for the historical issues is preserved (see
[`apps/app`](apps/app)) but the behaviors no longer reproduce on `vize@0.124.0`.

## Environment

- vize `0.124.0` (npm)
- @typescript/native-preview `7.0.0-dev.20260522.1`
- pnpm `11.0.9`
- Node `>=22`
- darwin / arm64 (other platforms not tested)

## Setup

```bash
pnpm install --config.minimumReleaseAge=0
```

---

## Repro 5 — `vize check` strips the `export` keyword when generating virtual TS for Options API SFC

`apps/app/src/OptionsApi.vue`:

```vue
<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "OptionsApi",
});
</script>

<template>
  <div>hello</div>
</template>
```

Run:

```bash
pnpm --filter app typecheck:vize
```

### Expected

`No type errors found!`

### Actual

```
src/OptionsApi.vue
  error:4:1 [TS1128] Declaration or statement expected.

1 error(s)
```

### Root cause (verified)

Inspect the virtual TS via `--show-virtual-ts`:

```bash
pnpm --filter app exec vize check src/OptionsApi.vue \
  --tsconfig tsconfig.json --show-virtual-ts | head -80
```

Around the `// User setup code` section, the virtual TS contains:

```ts
// User setup code


  default defineComponent({
    name: "OptionsApi",
  });
```

`vize check` has copied the user's `<script>` body into the synthetic
`__setup()` function but **stripped the `export` keyword** from
`export default defineComponent({...})`, leaving a bare `default` token.
`default` is a reserved keyword and only valid as a modifier on `export`,
so the TypeScript parser emits TS1128 at the line.

The same pattern repeats once per Options API SFC, so a project with many
classic `<script>` + `export default defineComponent` files (Tiptap node
views, Vue 2-style components, etc.) accumulates hundreds of false-positive
parse errors that no `typeChecker.*` setting or `--no-check-*` flag can
suppress.

### File layout

- [`apps/app/src/OptionsApi.vue`](apps/app/src/OptionsApi.vue) — minimal failing case
- [`apps/app/src/Child.vue`](apps/app/src/Child.vue) — props-defining child (`<script setup>` style, passes)
- [`apps/app/src/Parent.vue`](apps/app/src/Parent.vue) — uses Child (`<script setup>` style, passes)
- [`apps/app/vize.config.ts`](apps/app/vize.config.ts) — config kept from historical reproductions
- [`apps/app/package.json`](apps/app/package.json) — `lint:vize` / `typecheck:vize` scripts

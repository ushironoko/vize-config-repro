# vize-config-repro

Minimal reproduction repo for issues observed in the vize CLI (`vize lint` / `vize check`).

## Current issues (v0.126.0)

After the Options API parse-error fix (`ubugeeei/vize#613`, released as
`v0.126.0`), two issues remain in `vize check`:

- [Repro 6](#repro-6--vize-check-emits-unsanitised-kebab-case-component-identifiers-into-virtual-ts):
  templates using kebab-case component names (e.g. `<router-link>`,
  `<my-widget>`) cause `vize check` to emit identifiers containing `-`
  into the generated virtual TS (`type __router-link_Props_0 = ...`),
  producing TS1005 / TS1128 / TS1109 / TS1434 syntax errors.
- [Repro 7](#repro-7--vize-check-cannot-resolve-named-exports-from-vue-in-options-api-virtual-ts):
  `vize check` reports `TS2724 '"vue"' has no exported member named
  'defineComponent'` for `<script lang="ts"> + import { defineComponent } from "vue"`,
  even though `tsgo --noEmit` over the same workspace resolves the same
  import without error.

## Historical issues — Options API parse error (v0.124.0, FIXED in v0.126.0)

`vize check` used to generate invalid TypeScript for Options API SFCs
(`<script lang="ts">` + `export default defineComponent({ ... })`),
causing TS1128 parse errors that no user-side configuration could
silence. See [Repro 5](#repro-5--vize-check-strips-the-export-keyword-when-generating-virtual-ts-for-options-api-sfc).

## Historical issues (v0.114.0, all FIXED in v0.124.0)

1. `vize lint` ignored `linter.rules` — **FIXED**
2. `vize check` did not suppress base TS diagnostics via `typeChecker.*` — **FIXED**
3. `vize check` ignored `--corsa-path` / `CORSA_PATH` — **FIXED**
4. `vize check` could not locate `tsgo` when only the workspace root had
   `@typescript/native-preview` — **FIXED**

The reproduction file layout for the historical issues is preserved (see
[`apps/app`](apps/app)) but the behaviors no longer reproduce on `vize@0.124.0`.

## Environment

- vize `0.126.0` (npm)
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

---

## Repro 6 — `vize check` emits unsanitised kebab-case component identifiers into virtual TS

`apps/app/src/KebabCase.vue`:

```vue
<script setup lang="ts">
const value = 'hello'
</script>

<template>
  <my-widget :label="value" />
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/KebabCase.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/KebabCase.vue
  error:6:27 [TS1005] ',' expected.
  error:6:27 [TS1005] ';' expected.

1 file, 2 error(s)
```

### Root cause (verified)

Inspect the virtual TS with `--show-virtual-ts`. In the template-scope
block, `vize check` generates per-component type aliases using the **raw
template tag name** as the identifier:

```ts
type __my-widget_Props_0 = typeof my-widget extends { new (): { $props: infer __P } } ? __P : (...);
type __my-widget_0_prop_label = __my-widget_Props_0 extends { 'label'?: infer T } ? T : ...;
```

`my-widget` contains a `-`, which the TypeScript parser interprets as a
binary subtraction operator inside a type identifier position. The parser
then emits `TS1005` (and `TS1128` / `TS1109` / `TS1434` in more complex
templates).

The same generator path runs for **any** kebab-case component name that
is not resolved to a script binding — including `<router-link>` /
`<router-view>` from `vue-router`, auto-imported components, and any
locally-defined SFC referenced via its kebab-case alias. Built-in Vue
components such as `<transition-group>` go through a different path and
do **not** reproduce.

In a realistic codebase this produces hundreds of false-positive syntax
errors that no `typeChecker.*` setting or `--no-check-*` flag can
suppress. Sanitising the identifier (e.g. `my-widget` → `my_widget`) or
emitting a bracketed lookup would resolve it.

### File layout

- [`apps/app/src/KebabCase.vue`](apps/app/src/KebabCase.vue) — minimal failing case

---

## Repro 7 — `vize check` cannot resolve named exports from `vue` in Options API virtual TS

The same `apps/app/src/OptionsApi.vue` used in Repro 5 now surfaces a
different failure on `v0.126.0`. The parse error is gone, but `vize
check` cannot resolve `defineComponent` as a named export of `vue`
inside the generated virtual TS.

Run:

```bash
pnpm --filter app exec vize check src/OptionsApi.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/OptionsApi.vue
  error:2:10 [TS2724] '"vue"' has no exported member named 'defineComponent'. Did you mean 'DefineComponent'?
```

### Cross-check — `tsgo` over the same workspace passes

[`apps/app/src/ts-only.ts`](apps/app/src/ts-only.ts) contains the
**same** import:

```ts
import { defineComponent } from 'vue'

export default defineComponent({ name: 'X' })
```

Running TypeScript Native Preview directly on the workspace resolves the
import without error:

```bash
pnpm --filter app exec tsgo --noEmit --project tsconfig.json
# (exits 0, no diagnostics)
```

Therefore the failure is **not** a project-level module-resolution
problem. The base TS configuration (`moduleResolution: "Bundler"`) and
the pnpm-linked `node_modules/vue` → `@vue/runtime-dom` chain are both
resolvable when `tsgo` is invoked directly. The TS2724 only appears via
the virtual TS that `vize check` generates and feeds into `corsa` (the
vize-internal `tsgo` wrapper).

### Root cause (suspected)

`vize check`'s virtual TS embeds the user's `<script lang="ts">` module
imports verbatim and adds a synthetic prelude. Inspect with
`--show-virtual-ts`:

```ts
type __Ref<T> = import('vue').Ref<T>;
type __ShallowRef<T> = import('vue').ShallowRef<T>;
import { defineComponent } from "vue";
```

The dynamic `import('vue').Ref` references are accepted (they only
require the module to exist), but the static `import { defineComponent }
from "vue"` requires the named export to be visible. Something about the
virtual-file path / module-resolution context used by `corsa` prevents
the `export * from '@vue/runtime-dom'` re-export in `vue/dist/vue.d.ts`
from being followed — likely because the virtual TS is fed to `tsgo`
under a different anchor than the real `apps/app/tsconfig.json` rootDir.

### File layout

- [`apps/app/src/OptionsApi.vue`](apps/app/src/OptionsApi.vue) — failing SFC (same file as Repro 5)
- [`apps/app/src/ts-only.ts`](apps/app/src/ts-only.ts) — same `import` from a plain `.ts` file, used as the cross-check
- [`apps/app/tsconfig.json`](apps/app/tsconfig.json) — shared config (`moduleResolution: "Bundler"`)

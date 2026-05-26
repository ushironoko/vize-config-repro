# vize-config-repro

Minimal reproduction repo for issues observed in the vize CLI (`vize lint` / `vize check`).

## Current issue (v0.133.0)

After the kebab-case / vue-stub fix (`ubugeeei/vize#641`, released as
`v0.133.0`), one issue remains in `vize check`:

- [Repro 8](#repro-8--vize-check-splits-script-setup-type-and-value-declarations-into-different-scopes):
  `vize check` places `type` declarations from `<script setup>` into
  the **module scope** while keeping value declarations (`const`,
  `function`) inside the synthetic `__setup()` function. Patterns
  like `type X = (typeof someConst)[number]` therefore lose access to
  `someConst` and emit `TS2304 Cannot find name` / `TS2552 Did you
  mean...?`.

## Historical issues — kebab components / vue stubs (v0.126.0, FIXED in v0.133.0)

Two issues introduced (or unmasked) by the v0.126.0 Options API
parse-error fix were addressed by `ubugeeei/vize#641` in `v0.133.0`:

- [Repro 6](#repro-6--vize-check-emits-unsanitised-kebab-case-component-identifiers-into-virtual-ts):
  templates using kebab-case component names emitted identifiers
  containing `-` into the generated virtual TS, producing
  TS1005 / TS1128 / TS1109 / TS1434 syntax errors — **FIXED**.
- [Repro 7](#repro-7--vize-check-cannot-resolve-named-exports-from-vue-in-options-api-virtual-ts):
  `import { defineComponent } from "vue"` in Options API SFCs raised
  `TS2724 '"vue"' has no exported member named 'defineComponent'`,
  while `tsgo --noEmit` over the same workspace passed — **FIXED**.

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

- vize `0.133.0` (npm)
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

---

## Repro 8 — `vize check` splits `<script setup>` type and value declarations into different scopes

`apps/app/src/TypeofConst.vue`:

```vue
<script setup lang="ts">
type Name = (typeof names)[number]

const names = ['a', 'b', 'c'] as const

const value: Name = 'a'
</script>

<template>
  <div>{{ value }}</div>
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/TypeofConst.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/TypeofConst.vue
  error:2:21 [TS2552] Cannot find name 'names'. Did you mean 'name'?
```

### Cross-check — `tsgo` over the same pattern in a plain `.ts` file passes

[`apps/app/src/ts-only.ts`](apps/app/src/ts-only.ts) contains the same
declaration pattern:

```ts
type _Name = (typeof _names)[number]
const _names = ['a', 'b', 'c'] as const
export const _value: _Name = 'a'
```

```bash
pnpm --filter app exec tsgo --noEmit --project tsconfig.json
# (exits 0, no diagnostics)
```

The forward `typeof` reference from a `type` alias to a later `const`
is a standard TS pattern and resolves correctly under `tsgo` directly.
The failure only appears when `vize check` generates the virtual TS for
a `<script setup>` block.

### Root cause (verified)

Inspect the virtual TS with `--show-virtual-ts`. `vize check` lifts
`type` declarations from the user's `<script setup>` into the
**module scope** of the generated TS, while keeping `const` / `function`
value declarations inside the synthetic `__setup()` function:

```ts
// ========== Module Scope (imports) ==========
// (lifted from <script setup>)
type Name = (typeof names)[number]      // ❌ `names` is not in scope here

// ========== Setup Scope ==========
function __setup() {
  // User setup code
  const names = ['a', 'b', 'c'] as const  // ← defined inside __setup()
  const value: Name = 'a'
  ...
}
```

Because `typeof names` is a **value-space** reference (even though it
appears in a type position), it must be resolved against in-scope value
bindings. Splitting the two declarations across scopes breaks that
resolution and emits `TS2304` / `TS2552` for the typeof'd identifier.

In a realistic codebase any `<script setup>` block that derives a type
from a sibling `as const` array — a very common pattern for narrowed
string-literal unions — produces a false-positive diagnostic for every
typeof'd identifier. The failure scales with usage; a real project saw
**~7400 TS2304 + ~1084 TS2552 diagnostics across ~1966 SFCs**, none of
which `vue-tsc` or `tsgo` reproduce on the same sources.

### File layout

- [`apps/app/src/TypeofConst.vue`](apps/app/src/TypeofConst.vue) — minimal failing case
- [`apps/app/src/ts-only.ts`](apps/app/src/ts-only.ts) — same `typeof`-`const` pattern in a plain `.ts` file, used as the cross-check

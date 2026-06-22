# vize-config-repro

Minimal reproduction repo for issues observed in the vize CLI (`vize lint` / `vize check`).

## Newly observed (v0.217.0+)

After the Options API typed-`this` bridge was added (somewhere between
`v0.206.0` and `v0.217.0`), virtual-TS generation defects surface in
several common Options API shapes.

- [Repro 13](#repro-13--vize-check-emits-ts1xxx-on-options-api-sfcs-that-spread-an-external-props-object-alongside-setup--data--computed--methods)
  (FIXED in `v0.235.0` by `ubugeeei/vize#1838`): an Options API SFC with
  `props: { ...<external const> }` **and** `setup() { return { ... } }`
  **and** `data()` **and** `computed` (using `this.*`) **and** `methods`
  (using `this.*`) makes `vize check` emit four `TS1xxx` syntax errors
  (typically `TS1131` / `TS1128` / `TS1109`). The same SFC type-checks
  cleanly under `vue-tsc --noEmit`.
- [Repro 14](#repro-14--vize-check-emits-ts1xxx-on-options-api-sfcs-whose-script-section-has-multiple-long-line-comments-before-a-proptype-typed-prop-block)
  (FIXED in `v0.251.0`): when a `<script>` section contains several `//`
  line comments long enough to push the source past a certain column
  threshold, AND the SFC uses Options API `props: { ... }` with a
  `PropType<T[]>` entry plus at least one other multi-line object-form
  prop, `vize check` emits a cascade of `TS1xxx` syntax errors in the
  props region. The same SFC passes `vue-tsc --noEmit`. The bug count
  scaled with the number of long comment lines.
- [Repro 15](#repro-15--vize-check-no-longer-reports-the-child-component-props-type-mismatch-that-vue-tsc-catches-regression-since-v0235)
  (regression introduced between `v0.235.0` and `v0.251.0`): a `<script
  setup>` SFC that binds a `string` value to a child component's
  `number`-typed prop (`<Child :countTotal="wrong" />` where `wrong:
  string`) is no longer flagged by `vize check` on `v0.251.0`. The same
  SFC raised `TS2322 Type 'string' is not assignable to type 'number'`
  under `vize check` up to `v0.235.0`, matching `vue-tsc --noEmit`. This
  is a **false-negative regression** — `vize check` now silently passes
  a real type error that `vue-tsc` continues to catch.

## Current issues (v0.134.0)

After the typeof-anchored-types fix (`ubugeeei/vize#644`, released as
`v0.134.0`), four issues remain in `vize check`. All four pass under
`tsgo --noEmit` over the same workspace, so they are specific to the
virtual TS that `vize check` generates.

- [Repro 9](#repro-9--vize-check-does-not-load-ambient-declare-global-types):
  ambient types from a `.d.ts` (`declare global { type X }`) are not
  visible inside the generated virtual TS, so an SFC using `X` emits
  `TS2304 Cannot find name 'X'`.
- [Repro 10](#repro-10--vize-check-traps-script-setup-re-export-statements-inside-__setup):
  a re-export statement in `<script setup>` (`export { X }` /
  `export type { X }`) is emitted **inside** the synthetic `__setup()`
  function, producing `TS1233` / `TS2303` on the provider and
  `TS2614` on any consumer. Declaration exports (`export interface X`,
  `export type X = ...`) are lifted correctly and are unaffected.
- [Repro 11](#repro-11--vize-check-loses-script-setup-generic-type-parameters-in-type-declarations):
  in a `<script setup generic="T">` SFC, `type` declarations referencing
  the generic parameter `T` are lifted to the module scope while `T`
  only exists on `function __setup<T>()`, so `type Option = { key: T }`
  emits `TS2304 Cannot find name 'T'`. (A residual case of the Repro 8
  fix.)
- [Repro 12](#repro-12--vize-check-cannot-resolve-named-exports-from-vue-imported-via-a-path-alias):
  importing a `.vue` named export through a tsconfig `paths` alias
  (`@/Foo.vue`) falls back to the ambient `*.vue` stub and emits
  `TS2614`; the same import via a relative path resolves correctly.

## Historical issues — typeof-anchored types (v0.133.0, FIXED in v0.134.0)

`vize check` placed `type` declarations from `<script setup>` into the
module scope while keeping value declarations inside `__setup()`, so
`type X = (typeof someConst)[number]` lost access to `someConst` and
emitted `TS2304` / `TS2552`. Addressed by `ubugeeei/vize#644`. See
[Repro 8](#repro-8--vize-check-splits-script-setup-type-and-value-declarations-into-different-scopes).

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

- vize `0.134.0` (npm)
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
- [`apps/app/src/Child.vue`](apps/app/src/Child.vue) — props-defining child (`<script setup>` style, no Repro 5 error)
- [`apps/app/src/Parent.vue`](apps/app/src/Parent.vue) — uses Child (`<script setup>` style, no Repro 5 error; also serves as the [Repro 15](#repro-15--vize-check-no-longer-reports-the-child-component-props-type-mismatch-that-vue-tsc-catches-regression-since-v0235) fixture)
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

---

## Repro 9 — `vize check` does not load ambient `declare global` types

`apps/app/src/@types/globals.d.ts`:

```ts
declare global {
  type GlobalTabType = 'default' | 'wireframes' | 'liked'
}

export {}
```

`apps/app/src/UseGlobalType.vue`:

```vue
<script setup lang="ts">
const tab: GlobalTabType = 'default'
</script>

<template>
  <div>{{ tab }}</div>
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/UseGlobalType.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/UseGlobalType.vue
  error:2:12 [TS2304] Cannot find name 'GlobalTabType'.
```

### Cross-check — `tsgo` resolves the ambient type

```bash
pnpm --filter app exec tsgo --noEmit --project tsconfig.json
# (exits 0, no diagnostics)
```

`tsconfig.json` includes `src/**/*.ts` (which matches `.d.ts`), so the
global declaration is in the program. `tsgo` resolves `GlobalTabType`
fine; only the `vize check` virtual TS fails to see it, indicating the
ambient `.d.ts` is not added to the corsa virtual project.

### File layout

- [`apps/app/src/@types/globals.d.ts`](apps/app/src/@types/globals.d.ts) — ambient global type
- [`apps/app/src/UseGlobalType.vue`](apps/app/src/UseGlobalType.vue) — minimal failing case

---

## Repro 10 — `vize check` traps `<script setup>` re-export statements inside `__setup()`

`apps/app/src/ReExportType.ts`:

```ts
export type FilterType = 'image' | 'text'
```

`apps/app/src/ReExportType.vue` (provider):

```vue
<script setup lang="ts">
import { type FilterType } from './ReExportType'

export type { FilterType }

defineProps<{ kind?: FilterType }>()
</script>

<template>
  <div />
</template>
```

`apps/app/src/ReExportTypeConsumer.vue` (consumer):

```vue
<script setup lang="ts">
import ReExportType, { type FilterType } from './ReExportType.vue'

const v: FilterType = 'image'
</script>

<template>
  <ReExportType :kind="v" />
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/ReExportType.vue src/ReExportTypeConsumer.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/ReExportType.vue
  error:4:1 [TS1233] An export declaration can only be used at the top level of a namespace or module.
  error:4:15 [TS2303] Circular definition of import alias 'FilterType'.
src/ReExportTypeConsumer.vue
  error:2:29 [TS2614] Module '"./ReExportType.vue.ts"' has no exported member 'FilterType'. ...
```

### Root cause (verified)

Inspect the provider's virtual TS with `--show-virtual-ts`. The
re-export statement is emitted **inside** the synthetic `__setup()`
function:

```ts
// ========== Module Scope (imports) ==========
import { type FilterType } from './ReExportType'
export type Props = { kind?: FilterType };

// ========== Setup Scope ==========
function __setup() {
  export type { FilterType }      // ❌ export not valid inside a function
  ...
}
```

`export` statements are only valid at module top level, so TS emits
`TS1233`, and the alias collides with the module-scope import producing
`TS2303`. The named export is therefore dropped from the virtual module,
and any consumer that does `import { type FilterType } from './X.vue'`
sees `TS2614`.

Declaration exports are handled differently and are **not** affected —
see the passing control case in
[`NamedExport.vue`](apps/app/src/NamedExport.vue) (`export interface
TabConfig`), which is lifted to the module scope correctly.

### File layout

- [`apps/app/src/ReExportType.ts`](apps/app/src/ReExportType.ts) — the type source
- [`apps/app/src/ReExportType.vue`](apps/app/src/ReExportType.vue) — provider re-exporting via `export type { ... }` (fails)
- [`apps/app/src/ReExportTypeConsumer.vue`](apps/app/src/ReExportTypeConsumer.vue) — consumer (sees `TS2614`)
- [`apps/app/src/NamedExport.vue`](apps/app/src/NamedExport.vue) — control: declaration export (`export interface`) passes
- [`apps/app/src/NamedExportConsumer.vue`](apps/app/src/NamedExportConsumer.vue) — control consumer (passes)

---

## Repro 11 — `vize check` loses `<script setup>` generic type parameters in type declarations

`apps/app/src/Generic.vue`:

```vue
<script setup lang="ts" generic="T extends string">
type Option = { key: T; label: string }

defineProps<{
  options: Option[]
  current: T | undefined
}>()
</script>

<template>
  <ul>
    <li v-for="o in options" :key="o.key">{{ o.label }}</li>
  </ul>
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/Generic.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/Generic.vue
  error:2:22 [TS2304] Cannot find name 'T'.
```

### Root cause (verified)

Inspect the virtual TS with `--show-virtual-ts`. The user's `type Option`
is lifted to the module scope, but the generic parameter `T` only exists
on the `__setup` function signature:

```ts
// ========== Module Scope (imports) ==========
type Option = { key: T; label: string }   // ❌ T is not in scope here

// ========== Setup Scope ==========
function __setup<T extends string>() {     // ← T only lives here
  defineProps<{ options: Option[]; current: T | undefined }>()
  ...
}
```

This is a residual case of the Repro 8 fix: ordinary `<script setup>`
type declarations now stay inside `__setup()`, but for a
`generic="..."` SFC the type declaration is still lifted to the module
scope, separating it from the generic parameter it depends on.

### File layout

- [`apps/app/src/Generic.vue`](apps/app/src/Generic.vue) — minimal failing case

---

## Repro 12 — `vize check` cannot resolve named exports from `.vue` imported via a path alias

`apps/app/tsconfig.json` declares a `paths` alias:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

`apps/app/src/AliasProvider.vue`:

```vue
<script setup lang="ts">
export interface AliasConfig {
  key: string
  label: string
}

defineProps<{ configs: AliasConfig[] }>()
</script>

<template>
  <div />
</template>
```

`apps/app/src/AliasConsumer.vue`:

```vue
<script setup lang="ts">
import AliasProvider, { type AliasConfig } from '@/AliasProvider.vue'

const configs: AliasConfig[] = [{ key: 'a', label: 'A' }]
</script>

<template>
  <AliasProvider :configs="configs" />
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/AliasProvider.vue src/AliasConsumer.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!`

### Actual

```
src/AliasConsumer.vue
  error:2:30 [TS2614] Module '"*.vue"' has no exported member 'AliasConfig'. Did you mean to use 'import AliasConfig from "*.vue"' instead?
```

### Cross-check — the same import via a relative path passes

[`NamedExportConsumer.vue`](apps/app/src/NamedExportConsumer.vue) imports
the same kind of declaration export from `./NamedExport.vue` using a
**relative** path and passes:

```bash
pnpm --filter app exec vize check src/NamedExport.vue src/NamedExportConsumer.vue --tsconfig tsconfig.json
# No type errors found!
```

Both the provider and consumer are passed to `vize check`; only the
`paths`-alias form (`@/AliasProvider.vue`) fails. The error message
references the ambient `*.vue` module, indicating `vize check` resolves
the alias to the ambient stub instead of the alias target's generated
virtual TS.

### File layout

- [`apps/app/tsconfig.json`](apps/app/tsconfig.json) — declares the `@/*` → `src/*` alias
- [`apps/app/src/AliasProvider.vue`](apps/app/src/AliasProvider.vue) — provider (`export interface AliasConfig`)
- [`apps/app/src/AliasConsumer.vue`](apps/app/src/AliasConsumer.vue) — consumer importing via `@/AliasProvider.vue` (fails)
- [`apps/app/src/NamedExportConsumer.vue`](apps/app/src/NamedExportConsumer.vue) — control: same import via relative path (passes)

---

## Repro 13 — `vize check` emits TS1xxx on Options API SFCs that spread an external props object alongside setup / data / computed / methods

Observed against `vize@0.217.0` and `vize@0.219.0` with
`@typescript/native-preview@7.0.0-dev.20260602.1`.

[`apps/app/src/OptionsApiPropsSpread.vue`](apps/app/src/OptionsApiPropsSpread.vue):

```vue
<script lang="ts">
import { defineComponent } from 'vue'

const sharedProps = {
  meta: { type: Object, required: true as const },
}

function useFakeStore() {
  return { cached: (s: string, _b: boolean) => s }
}

export default defineComponent({
  props: { ...sharedProps },
  setup() {
    const store = useFakeStore()
    return { store }
  },
  data() {
    return { missing: false }
  },
  computed: {
    url() {
      return this.store.cached('x', false)
    },
  },
  methods: {
    onError(_a: unknown) {
      this.missing = true
    },
  },
})
</script>
```

Run:

```bash
pnpm --filter app exec vize check src/OptionsApiPropsSpread.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!` — `vue-tsc --noEmit -p tsconfig.json` reports
zero errors on this SFC.

### Actual

```
src/OptionsApiPropsSpread.vue
  error:12:63 [TS1131] Property or signature expected.
  error:13:4  [TS1128] Declaration or statement expected.
  error:13:5  [TS1109] Expression expected.
  error:13:6  [TS1109] Expression expected.

4 error(s)
```

The reported `line:column` positions point at the closing of the props
block in the original SFC (`12:63` and `13:4-6`), but the source SFC at
those positions is syntactically valid TypeScript — `vue-tsc` over the
same file under the same `tsconfig.json` passes.

### Trigger surface (bisected)

Removing **any one** of the five elements below from the same SFC makes
the four errors disappear. Inlining the props (writing
`meta: { type: Object, required: true as const }` directly inside
`props: { ... }`, with no `...spread`) also makes them disappear.

1. `props: { ...<external const object> }` — props spread from an
   outer-scope const
2. `setup() { return { ... } }` — setup with a non-empty return
3. `data()` returning at least one field
4. `computed: { name() { return this.<setup-returned>.* } }` — a
   computed that resolves `this.*` to a setup-returned member
5. `methods: { name(arg) { this.<data-key> = ... } }` — a method that
   writes to a `data()` field via `this`

This is the shape that recurs in many real-world Options API SFCs
(setup return + store cross-reference + data + this-mutating methods +
shared props mixin), so the false-positive count scales with the number
of such files in a project.

### Cross-check — vue-tsc

```bash
pnpm --filter app exec vue-tsc --noEmit -p tsconfig.json 2>&1 \
  | grep OptionsApiPropsSpread
# (no output — vue-tsc reports no errors for this file)
```

### File layout

- [`apps/app/src/OptionsApiPropsSpread.vue`](apps/app/src/OptionsApiPropsSpread.vue) — minimal 5-block reproduction (4 errors under `vize check`, 0 under `vue-tsc`)

---

## Repro 14 — `vize check` emits TS1xxx on Options API SFCs whose `<script>` section has multiple long line comments before a `PropType<T[]>`-typed prop block

Observed against `vize@0.235.0` with
`@typescript/native-preview@7.0.0-dev.20260602.1`. Repro 13 was fixed in
the same release, but this distinct virtual-TS generator defect remains.

[`apps/app/src/OptionsApiPropsLongComment.vue`](apps/app/src/OptionsApiPropsLongComment.vue):

```vue
<script lang="ts">
import { defineComponent, PropType } from 'vue'

interface Item { id: number }

// long enough comment line one xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// long enough comment line two xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// long enough comment line three xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// long enough comment line four xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// long enough comment line five xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

export default defineComponent({
  props: {
    items: {
      type: Array as PropType<Item[]>,
      required: false,
    },
    size: {
      type: Number,
      default: 0,
    },
  },
})
</script>
```

Run:

```bash
pnpm --filter app exec vize check src/OptionsApiPropsLongComment.vue --tsconfig tsconfig.json
```

### Expected

`No type errors found!` — `vue-tsc --noEmit -p tsconfig.json` reports
zero errors on this SFC.

### Actual

```
src/OptionsApiPropsLongComment.vue
  error:15:22 [TS1005] ';' expected.
  error:16:18 [TS1005] ';' expected.
  error:18:1  [TS1109] Expression expected.
  error:18:2  [TS1128] Declaration or statement expected.
  error:20:10 [TS1109] Expression expected.
  error:20:17 [TS1128] Declaration or statement expected.
  error:22:1  [TS1109] Expression expected.
  error:22:2  [TS1128] Declaration or statement expected.
  error:23:1  [TS1128] Declaration or statement expected.
  error:23:2  [TS1109] Expression expected.
  error:23:3  [TS1109] Expression expected.

11 error(s)
```

The reported `line:column` positions point at lines 15-23 of the source
SFC. Those lines are syntactically valid TypeScript and `vue-tsc` passes
on them — the column drift looks like the generator is mis-mapping the
virtual-TS layout back onto the original source when the leading region
contains multiple long `//` comments.

### Trigger surface (bisected)

All four of the following are required to reproduce. Removing any one
returns the file to 0 errors:

1. A run of **two or more `//` line comments** in `<script>` where each
   comment line is wide enough (in this fixture, ≥ ~76 chars). Replacing
   the comments with **blank lines** of the same count makes the errors
   disappear, so the trigger is comment width, not file length.
2. An Options API `export default defineComponent({ ... })` (the bug does
   not appear with `<script setup>`).
3. A `props: { ... }` entry whose `type:` uses `Array as PropType<T[]>`
   (a generic type-assertion in type position). Replacing the entry with
   `items: { type: Array, required: false }` makes the errors disappear.
4. **At least one other multi-line object-form prop entry** alongside the
   `PropType<T[]>` one. Collapsing it to `size: { type: Number, default: 0 }`
   on a single line makes the errors disappear.

Increasing the number of long comment lines linearly increases the
diagnostic count (5 lines → 11 errors in this fixture).

### Cross-check — vue-tsc

```bash
pnpm --filter app exec vue-tsc --noEmit -p tsconfig.json 2>&1 \
  | grep OptionsApiPropsLongComment
# (no output — vue-tsc reports no errors for this file)
```

### File layout

- [`apps/app/src/OptionsApiPropsLongComment.vue`](apps/app/src/OptionsApiPropsLongComment.vue) — minimal reproduction (11 errors under `vize check`, 0 under `vue-tsc`)

---

## Repro 15 — `vize check` no longer reports the child-component props type mismatch that `vue-tsc` catches (regression since v0.235)

Observed against `vize@0.251.0` with
`@typescript/native-preview@7.0.0-dev.20260602.1`. Up to and including
`v0.235.0`, `vize check` correctly reported the type mismatch shown below
(matching `vue-tsc`); on `v0.251.0` it silently passes. This is a
**false-negative regression** in `vize check`'s template prop-type
verification.

The fixture reuses the existing [`Parent.vue`](apps/app/src/Parent.vue) /
[`Child.vue`](apps/app/src/Child.vue) pair (they were originally added as
the `<script setup>` control case for [Repro 5](#repro-5--vize-check-strips-the-export-keyword-when-generating-virtual-ts-for-options-api-sfc)).

[`apps/app/src/Child.vue`](apps/app/src/Child.vue):

```vue
<script setup lang="ts">
const props = defineProps<{ countTotal: number }>();
</script>

<template>
  <span>{{ props.countTotal }}</span>
</template>
```

[`apps/app/src/Parent.vue`](apps/app/src/Parent.vue):

```vue
<script setup lang="ts">
import Child from "./Child.vue";

const wrong: string = "not a number";
</script>

<template>
  <Child :countTotal="wrong" />
</template>
```

Run:

```bash
pnpm --filter app exec vize check src/Parent.vue src/Child.vue --tsconfig tsconfig.json
```

### Expected

`Parent.vue` binds a `string` value to a prop typed `number`. `vue-tsc
--noEmit -p tsconfig.json` reports:

```
src/Parent.vue(8,11): error TS2322: Type 'string' is not assignable to type 'number'.
```

`vize check` should report the same mismatch (and did, up to `v0.235.0`).

### Actual (`v0.251.0`)

```
No type errors found!
```

`vize check` exits clean on the same fixture, missing the prop type
mismatch entirely.

### Cross-version timeline

| vize version | `Parent.vue` `vize check` result | matches `vue-tsc`? |
| --- | --- | --- |
| `v0.217.0` | `TS2322` reported at `src/Parent.vue:8:18` | ✅ |
| `v0.235.0` | `TS2322` reported at `src/Parent.vue:8:18` | ✅ |
| `v0.251.0` | **no diagnostic** | ❌ (false negative) |

The column drift between `8,11` (vue-tsc, attribute name) and `8:18`
(prior `vize check`, value expression) is orthogonal to the regression
itself.

### Why this is severe

The earlier reproductions in this repo (Repros 5–14) describe
**false-positive** behaviors of `vize check` — `vize check` emits
diagnostics that `vue-tsc` does not. Those make `vize check` *noisier*
than `vue-tsc` but not unsafe to gate CI on.

Repro 15 is the opposite: `vize check` **misses** a diagnostic that
`vue-tsc` reports. Any project that gates CI on `vize check` from
`v0.236.0` onward will silently accept template prop-type mismatches
that `vue-tsc` would have flagged.

### File layout

- [`apps/app/src/Parent.vue`](apps/app/src/Parent.vue) — consumer binding `string` to a `number` prop (must fail)
- [`apps/app/src/Child.vue`](apps/app/src/Child.vue) — child component with `defineProps<{ countTotal: number }>()`
- [`apps/app/tsconfig.json`](apps/app/tsconfig.json) — shared strict tsconfig

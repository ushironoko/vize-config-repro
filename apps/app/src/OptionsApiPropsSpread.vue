<script lang="ts">
import { defineComponent } from 'vue'

// Repro 13: vize check emits TS1xxx syntax errors on Options API SFCs that
// combine all five of:
//   - `props: { ...<external const> }`  (spread an outer-scope props object)
//   - `setup()` with a `return { ... }`
//   - `data()` returning state
//   - `computed: { name() { return this.<setup-returned>.* } }`
//   - `methods: { name(arg) { this.<data-key> = ... } }`
//
// Removing the props spread (writing `meta: { ... }` inline) or removing
// any one of setup / data / computed / methods makes the errors disappear.
// vue-tsc reports 0 errors on this SFC.

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

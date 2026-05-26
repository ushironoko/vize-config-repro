import { defineComponent } from 'vue'

export default defineComponent({ name: 'X' })

// Repro 8 cross-check: same typeof-const pattern in a plain .ts file
type _Name = (typeof _names)[number]
const _names = ['a', 'b', 'c'] as const
export const _value: _Name = 'a'

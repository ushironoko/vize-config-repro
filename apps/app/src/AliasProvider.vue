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

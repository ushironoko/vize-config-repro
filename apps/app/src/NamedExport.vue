<script setup lang="ts">
export interface TabConfig {
  key: string
  label: string
}

defineProps<{ tabs: TabConfig[] }>()
</script>

<template>
  <div />
</template>

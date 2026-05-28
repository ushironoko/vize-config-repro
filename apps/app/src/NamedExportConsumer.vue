<script setup lang="ts">
import NamedExport, { type TabConfig } from './NamedExport.vue'

const tabs: TabConfig[] = [{ key: 'a', label: 'A' }]
</script>

<template>
  <NamedExport :tabs="tabs" />
</template>

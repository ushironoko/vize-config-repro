<script setup lang="ts">
import AliasProvider, { type AliasConfig } from '@/AliasProvider.vue'

const configs: AliasConfig[] = [{ key: 'a', label: 'A' }]
</script>

<template>
  <AliasProvider :configs="configs" />
</template>

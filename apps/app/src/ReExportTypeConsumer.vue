<script setup lang="ts">
import ReExportType, { type FilterType } from './ReExportType.vue'

const v: FilterType = 'image'
</script>

<template>
  <ReExportType :kind="v" />
</template>

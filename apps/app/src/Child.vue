<script setup lang="ts">
const props = defineProps<{ countTotal: number }>();
</script>

<template>
  <span>{{ props.countTotal }}</span>
</template>

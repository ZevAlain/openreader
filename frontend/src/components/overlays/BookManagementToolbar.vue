<template>
  <v-text-field
    :model-value="modelValue"
    placeholder="搜索书名或作者"
    clearable
    density="compact"
    variant="outlined"
    hide-details
    class="search-input"
    :prepend-inner-icon="mdiMagnify"
    @update:model-value="value => emit('update:modelValue', value)"
  />
</template>

<script setup>
import { mdiMagnify } from '@mdi/js'

defineProps({
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.search-input {
  margin-bottom: 10px;
}
</style>

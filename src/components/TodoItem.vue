<script setup>
const props = defineProps(['todo', 'index'])
const emit = defineEmits(['remove', 'update', 'toggle'])
</script>

<template>
  <li
  draggable="true"
  @dragstart="$emit('dragstart', index)"
>
  <input type="checkbox" v-model="todo.done" @change="$emit('toggle')" />
  {{ todo.text }}
  <button @click="$emit('remove', index)">✕</button>
</li>
</template>

<style scoped>
.done {
  text-decoration: line-through;
  color: gray;
}
</style>
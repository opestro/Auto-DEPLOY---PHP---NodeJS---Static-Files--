<template>
  <div 
    class="px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1"
    :class="statusClasses"
  >
    <div 
      class="w-2 h-2 rounded-full"
      :class="dotClasses"
    ></div>
    <span>{{ status }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    required: true
  }
});

const statusClasses = computed(() => ({
  'bg-green-100 text-green-800': props.status === 'connected',
  'bg-red-100 text-red-800': props.status === 'disconnected',
  'bg-yellow-100 text-yellow-800': props.status === 'connecting'
}));

const dotClasses = computed(() => ({
  'bg-green-500': props.status === 'connected',
  'bg-red-500': props.status === 'disconnected',
  'bg-yellow-500': props.status === 'connecting'
}));
</script> 
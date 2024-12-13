<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>
    <div class="relative bg-dark-accent/90 rounded-2xl border border-gray-700/30 p-6 w-full max-w-lg">
      <div class="text-xl font-bold mb-4">
        <slot name="title"></slot>
      </div>
      <div class="mb-6">
        <slot name="content"></slot>
      </div>
      <div class="flex justify-end space-x-3">
        <button 
          @click="$emit('close')"
          class="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template> 
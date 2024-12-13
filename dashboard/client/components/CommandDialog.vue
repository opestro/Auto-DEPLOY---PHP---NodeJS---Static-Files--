<template>
  <div v-if="show" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
    <div class="feature-card rounded-3xl w-full max-w-2xl p-8">
      <h2 class="text-xl font-bold feature-title mb-6">Execute Commands</h2>
      
      <!-- Command Source Selection -->
      <div class="mb-6 space-y-3">
        <label class="flex items-center space-x-3 p-3 rounded-xl transition-colors cursor-pointer hover:bg-white/5">
          <input 
            type="radio" 
            v-model="useFile" 
            :value="true"
            class="form-radio text-primary border-gray-600 bg-dark-accent focus:ring-primary"
          >
          <span class="text-gray-200">Use .deploycommands file</span>
        </label>
        <label class="flex items-center space-x-3 p-3 rounded-xl transition-colors cursor-pointer hover:bg-white/5">
          <input 
            type="radio" 
            v-model="useFile" 
            :value="false"
            class="form-radio text-primary border-gray-600 bg-dark-accent focus:ring-primary"
          >
          <span class="text-gray-200">Write commands</span>
        </label>
      </div>

      <!-- Command Input -->
      <div v-if="!useFile" class="mb-6">
        <textarea
          v-model="commands"
          class="w-full h-48 font-mono text-sm p-4 rounded-xl bg-dark-accent border border-gray-700/50 text-gray-200 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          placeholder="# Enter commands using Docker-like syntax
RUN npm install
WORKDIR ./public
RUN npm run build"
        ></textarea>
      </div>

      <!-- Progress -->
      <div v-if="isExecuting" class="mb-6">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-gray-400">Progress</span>
          <span class="text-primary">{{ Math.round(progress) }}%</span>
        </div>
        <div class="w-full bg-dark-accent rounded-full h-2">
          <div 
            class="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end space-x-3">
        <button 
          @click="$emit('close'); resetDialog()"
          class="command-text px-6"
          :disabled="isExecuting"
        >
          Cancel
        </button>
        <button 
          @click="execute"
          class="command-text px-6 bg-primary/20 border-primary/30 text-primary"
          :disabled="isExecuting"
        >
          Execute
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feature-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  backdrop-filter: blur(24px);
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.feature-title {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'execute']);

const useFile = ref(true);
const commands = ref('');
const isExecuting = ref(false);
const progress = ref(0);

// Reset dialog state when it's closed
watch(() => props.show, (newValue) => {
  if (!newValue) {
    resetDialog();
  }
});

function resetDialog() {
  isExecuting.value = false;
  progress.value = 0;
  commands.value = '';
  useFile.value = true;
}

async function execute() {
  try {
    isExecuting.value = true;
    progress.value = 0;

    emit('execute', {
      useFile: useFile.value,
      commands: useFile.value ? null : commands.value
    });

    // Close dialog after a short delay
    setTimeout(() => {
      emit('close');
      resetDialog();
    }, 1000);

  } catch (error) {
    console.error('Command execution error:', error);
    isExecuting.value = false;
  }
}
</script>
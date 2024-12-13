<template>
  <div class="feature-card rounded-3xl p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold feature-title">Deployment Logs</h2>
      <div class="flex items-center space-x-3">
        <button 
          @click="clearLogs"
          class="command-text px-4 py-2 text-sm"
        >
          Clear Logs
        </button>
        <select 
          v-model="filterType"
          class="bg-dark-accent text-gray-200 text-sm border border-gray-700/50 rounded-xl px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        >
          <option value="all">All Logs</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>
    </div>
    
    <div 
      ref="logContainer"
      class="bg-dark-accent/50 rounded-2xl p-6 font-mono text-sm text-gray-300 max-h-[32rem] overflow-y-auto border border-gray-700/30"
    >
      <!-- Empty state -->
      <div 
        v-if="!props.logs?.length" 
        class="text-center py-8 text-gray-500"
      >
        <div class="text-4xl mb-3">📝</div>
        <div>No logs to display</div>
        <div class="text-sm">Deployment logs will appear here</div>
      </div>

      <!-- Logs -->
      <template v-else>
        <div 
          v-for="log in chronologicalLogs" 
          :key="log.id"
          class="py-1.5"
        >
          <!-- Timestamp -->
          <span class="text-gray-500">[{{ log.timestamp }}]</span>

          <!-- Command execution specific styling -->
          <div 
            :class="{
              'text-primary': log.type === 'info',
              'text-green-400': log.type === 'success',
              'text-yellow-400': log.type === 'warning',
              'text-red-400': log.type === 'error',
              'ml-4': log.command || log.output
            }"
          >
            <!-- Command info -->
            <template v-if="log.command">
              <div class="flex items-center space-x-2 bg-dark/30 px-3 py-1.5 rounded-lg my-1">
                <span class="text-primary">➜</span>
                <span class="font-semibold">{{ log.message }}</span>
              </div>
            </template>
            <!-- Regular log message -->
            <template v-else>
              <span>{{ log.message }}</span>
            </template>

            <!-- Command output -->
            <div 
              v-if="log.output"
              class="ml-6 mt-1.5 text-gray-400 whitespace-pre-wrap bg-black/20 px-3 py-2 rounded-lg"
            >
              {{ log.output }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

const props = defineProps({
  logs: {
    type: Array,
    required: true,
    default: () => []
  }
});

const emit = defineEmits(['clear']);
const filterType = ref('all');
const logContainer = ref(null);
const autoScroll = ref(true);

// Compute logs in chronological order (oldest to newest)
const chronologicalLogs = computed(() => {
  const logsArray = props.logs || [];
  if (filterType.value === 'all') {
    return [...logsArray].reverse();
  }
  return [...logsArray].filter(log => log.type === filterType.value).reverse();
});

// Auto-scroll functionality
watch(() => props.logs, () => {
  if (autoScroll.value && logContainer.value) {
    nextTick(() => {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    });
  }
}, { deep: true });

function handleScroll() {
  if (!logContainer.value) return;
  
  const { scrollTop, scrollHeight, clientHeight } = logContainer.value;
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 50;
}

onMounted(() => {
  if (logContainer.value) {
    logContainer.value.addEventListener('scroll', handleScroll);
    // Initial scroll to bottom
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

onUnmounted(() => {
  if (logContainer.value) {
    logContainer.value.removeEventListener('scroll', handleScroll);
  }
});

function clearLogs() {
  emit('clear');
}
</script>

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

.command-text {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
  background: rgba(41, 151, 255, 0.1);
  border: 0.5px solid rgba(41, 151, 255, 0.2);
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  color: #2997FF;
}

.command-text:hover:not(:disabled) {
  background: rgba(41, 151, 255, 0.15);
  border-color: rgba(41, 151, 255, 0.3);
}

/* Custom scrollbar for the log container */
.max-h-[32rem] {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.max-h-[32rem]::-webkit-scrollbar {
  width: 6px;
}

.max-h-[32rem]::-webkit-scrollbar-track {
  background: transparent;
}

.max-h-[32rem]::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.max-h-[32rem]::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
</style> 
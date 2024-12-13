<template>
  <div class="feature-card rounded-3xl p-8 mt-6">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold feature-title">Ignore Patterns</h2>
      <div class="space-x-2">
        <button 
          @click="save"
          class="command-text px-6"
          :disabled="saving"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <div class="mb-6">
      <p class="text-sm text-gray-400 mb-3">
        Add patterns to ignore files and directories (one per line)
      </p>
      <textarea
        v-model="patternsText"
        class="w-full h-64 font-mono text-sm p-4 rounded-xl bg-dark-accent border border-gray-700/50 text-gray-200 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        placeholder="# Add ignore patterns here
*.log
temp/*"
      ></textarea>
    </div>

    <div class="text-sm text-gray-400">
      <p class="mb-2 text-gray-300">Examples:</p>
      <div class="space-y-2">
        <div class="flex items-center space-x-2 p-2 rounded-lg bg-dark-accent/50">
          <span class="text-primary">*.log</span>
          <span class="text-gray-500">- Ignore all log files</span>
        </div>
        <div class="flex items-center space-x-2 p-2 rounded-lg bg-dark-accent/50">
          <span class="text-primary">temp/*</span>
          <span class="text-gray-500">- Ignore everything in temp directory</span>
        </div>
        <div class="flex items-center space-x-2 p-2 rounded-lg bg-dark-accent/50">
          <span class="text-primary">dist/**</span>
          <span class="text-gray-500">- Ignore dist directory and all subdirectories</span>
        </div>
        <div class="flex items-center space-x-2 p-2 rounded-lg bg-dark-accent/50">
          <span class="text-primary">*.{jpg,png}</span>
          <span class="text-gray-500">- Ignore all jpg and png files</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const patternsText = ref('');
const saving = ref(false);

async function loadPatterns() {
  try {
    const response = await fetch('http://localhost:3001/api/ignore');
    const { patterns } = await response.json();
    patternsText.value = patterns.join('\n');
  } catch (error) {
    console.error('Error loading ignore patterns:', error);
  }
}

async function save() {
  try {
    saving.value = true;
    const patterns = patternsText.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    await fetch('http://localhost:3001/api/ignore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ patterns })
    });
  } catch (error) {
    console.error('Error saving ignore patterns:', error);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadPatterns();
});
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
  padding: 0.75rem 1.25rem;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  color: #2997FF;
}

.command-text:hover:not(:disabled) {
  background: rgba(41, 151, 255, 0.15);
  border-color: rgba(41, 151, 255, 0.3);
}

.command-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style> 
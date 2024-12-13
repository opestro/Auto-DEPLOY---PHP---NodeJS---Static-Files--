<template>
  <div class="min-h-screen bg-[#000000] text-gray-100">
    <!-- Top Navigation -->
    <nav class="glass-effect fixed w-full z-50">
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <span class="text-2xl font-bold gradient-text tracking-tight">
              CSDeploy
            </span>
          </div>
          <div class="flex items-center space-x-4">
            <ConnectionStatus :status="connectionStatus" />
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-24">
      <div class="grid grid-cols-12 gap-6">
        <!-- Deployment Actions -->
        <div class="col-span-12 lg:col-span-4">
          <div class="feature-card rounded-3xl p-8">
            <h2 class="text-xl font-bold feature-title mb-6">Deployment</h2>
            <div class="space-y-4">
              <button 
                @click="deployFiles" 
                :disabled="isDeploying"
                class="w-full command-text flex items-center justify-center"
              >
                <DocumentArrowUpIcon class="w-5 h-5 mr-2" />
                Deploy Files
              </button>
              <button 
                @click="executeCommands"
                :disabled="isDeploying"
                class="w-full command-text flex items-center justify-center"
              >
                <CommandLineIcon class="w-5 h-5 mr-2" />
                Execute Commands
              </button>
            </div>
          </div>

          <!-- Configuration -->
          <div class="feature-card rounded-3xl p-8 mt-6">
            <h2 class="text-xl font-bold feature-title mb-6">Configuration</h2>
            <div class="space-y-2">
              <div v-if="config">
                <div class="flex justify-between py-2 border-b border-gray-700/30">
                  <span class="text-gray-400">Host</span>
                  <span class="font-mono text-primary">{{ config.host }}</span>
                </div>
                <div class="flex justify-between py-2 border-b border-gray-700/30">
                  <span class="text-gray-400">Type</span>
                  <span class="font-mono text-secondary">{{ config.type }}</span>
                </div>
                <div class="flex justify-between py-2">
                  <span class="text-gray-400">Remote Path</span>
                  <span class="font-mono text-primary">{{ config.remotePath }}</span>
                </div>
              </div>
            </div>
          </div>

          <IgnoreEditor />
        </div>

        <!-- File Changes & Logs -->
        <div class="col-span-12 lg:col-span-8 space-y-6">
            
            <LogViewer :logs="deploymentLogs" @clear="clearLogs" />
            <FileBrowser />
          </div>
      </div>
    </div>

    <!-- Add CommandDialog -->
    <CommandDialog 
      :show="showCommandDialog"
      @close="showCommandDialog = false"
      @execute="handleCommandExecution"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { io } from 'socket.io-client';
import {
  DocumentArrowUpIcon,
  CommandLineIcon,
  DocumentIcon,
  FolderIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import LogViewer from '../components/LogViewer.vue';
import IgnoreEditor from '../components/IgnoreEditor.vue';
import FileBrowser from '../components/FileBrowser.vue';
import CommandDialog from '../components/CommandDialog.vue';
// State
const socket = ref(null);
const connectionStatus = ref('connecting');
const changedFiles = ref([]);
const deploymentLogs = ref([]);
const isDeploying = ref(false);
const config = ref(null);
const currentPath = ref('/');
const currentFiles = ref([]);
const showCommandDialog = ref(false);
const isWatching = ref(false);
const fileProgress = ref(0);
const processedFiles = ref(0);
const totalFiles = ref(0);

// Computed
const pathSegments = computed(() => {
  return currentPath.value.split('/').filter(Boolean);
});

// Methods
function addLog(log) {
  deploymentLogs.value.unshift(log);
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

async function deployFiles() {
  try {
    isDeploying.value = true;
    deploymentLogs.value = []; // Clear previous logs
    socket.value.emit('deployFiles');
  } catch (error) {
    console.error('Deployment error:', error);
    isDeploying.value = false;
  }
}

async function executeCommands() {
  showCommandDialog.value = true;
}

function navigateUp() {
  const segments = currentPath.value.split('/').filter(Boolean);
  segments.pop();
  currentPath.value = '/' + segments.join('/');
  loadFiles();
}

function navigateToSegment(index) {
  const segments = pathSegments.value.slice(0, index + 1);
  currentPath.value = '/' + segments.join('/');
  loadFiles();
}

function navigateTo(folder) {
  currentPath.value = `${currentPath.value}/${folder}`.replace(/\/+/g, '/');
  loadFiles();
}

async function loadFiles() {
  socket.value.emit('browseFiles', currentPath.value);
}

async function removeFile(file) {
  if (!confirm(`Are you sure you want to remove ${file.name}?`)) return;
  
  socket.value.emit('removeFile', {
    path: `${currentPath.value}/${file.name}`.replace(/\/+/g, '/'),
    isDirectory: file.isDirectory
  });
}

function clearLogs() {
  deploymentLogs.value = [];
}

async function handleCommandExecution(data) {
  try {
    isDeploying.value = true;
    deploymentLogs.value = []; // Clear previous logs
    socket.value.emit('executeCommands', data);
  } catch (error) {
    console.error('Command execution error:', error);
    isDeploying.value = false;
    addLog({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message: `Command execution failed: ${error.message}`,
      type: 'error'
    });
  }
}

// Socket setup
onMounted(async () => {
  socket.value = io('http://localhost:3001');

  socket.value.on('connect', () => {
    connectionStatus.value = 'connected';
    addLog({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message: 'Connected to server',
      type: 'info'
    });
  });

  // Update log handling
  socket.value.on('log', (log) => {
    if (log) {
      deploymentLogs.value = [log, ...deploymentLogs.value];
    }
  });

  socket.value.on('deploymentStatus', (data) => {
    isDeploying.value = data.status !== 'completed' && data.status !== 'failed';
  });

  socket.value.on('disconnect', () => {
    connectionStatus.value = 'disconnected';
    addLog({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message: 'Disconnected from server',
      type: 'warning'
    });
    isWatching.value = false;
  });

  socket.value.on('fileChanges', ({ changedFiles, total, processed, progress }) => {
    if (total) {
      totalFiles.value = total;
      processedFiles.value = processed;
      fileProgress.value = progress;
      
      // Add new files to the current list
      currentFiles.value = [...currentFiles.value, ...changedFiles];
      
      // Log progress
      addLog(`Processing files: ${processed}/${total} (${progress}%)`, 'info');
    }
  });

  socket.value.on('deploymentStatus', (data) => {
    if (data.status === 'completed') {
      isDeploying.value = false;
      addLog(`${data.type} deployment completed`, 'success');
    } else if (data.status === 'failed') {
      isDeploying.value = false;
      addLog(`${data.type} deployment failed: ${data.error}`, 'error');
    }
  });

  socket.value.on('deploymentProgress', (data) => {
    addLog(`${data.file}: ${data.status}`, 'info');
  });

  socket.value.on('fileList', ({ files }) => {
    currentFiles.value = files;
  });

  socket.value.on('fileRemoved', () => {
    addLog('File removed successfully', 'success');
    loadFiles();
  });

  socket.value.on('error', ({ message }) => {
    addLog(`Error: ${message}`, 'error');
    if (message.includes('file watch')) {
      isWatching.value = false;
    }
  });

  socket.value.on('logs', (logs) => {
    deploymentLogs.value = logs;
  });

  socket.value.on('logsCleared', () => {
    deploymentLogs.value = [];
  });

  socket.value.on('commandProgress', (data) => {
    addLog({
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message: data.message,
      type: data.type,
      command: data.command,
      output: data.output
    });
  });

  socket.value.on('startFileWatch', () => {
    fileProgress.value = 0;
    processedFiles.value = 0;
    totalFiles.value = 0;
    currentFiles.value = [];
  });

  socket.value.on('fileWatchComplete', () => {
    setTimeout(() => {
      fileProgress.value = 0;
      processedFiles.value = 0;
      totalFiles.value = 0;
    }, 1000);
  });

  socket.value.on('deploymentStatus', (data) => {
    if (data.type === 'commands') {
      isDeploying.value = false;
      if (showCommandDialog.value) {
        showCommandDialog.value = false;
      }
    }
  });

  // Clean up function
  onBeforeUnmount(() => {
    if (socket.value) {
      socket.value.off('log');
      socket.value.off('deploymentStatus');
      socket.value.off('connect');
      socket.value.off('disconnect');
      socket.value.disconnect();
    }
  });

  // Load initial data
  try {
    const [configResponse, filesResponse] = await Promise.all([
      fetch('http://localhost:3001/api/config'),
      fetch('http://localhost:3001/api/files')
    ]);
    
    config.value = await configResponse.json();
    currentFiles.value = await filesResponse.json();
  } catch (error) {
    addLog(`Error loading initial data: ${error.message}`, 'error');
  }
});
</script>
<style scoped>
.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(0, 0, 0, 0.8);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
}

.gradient-text {
  background: linear-gradient(135deg, #2997FF 0%, #A855F7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.feature-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  backdrop-filter: blur(24px);
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.feature-card:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-color: rgba(255, 255, 255, 0.12);
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

.feature-title {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>


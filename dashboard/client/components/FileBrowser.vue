<template>
  <div class="feature-card rounded-3xl p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold feature-title">File Browser</h2>
      
      <!-- Action Buttons -->
      <div class="flex items-center space-x-3">
        <button 
          @click="showCreateFolderDialog = true"
          class="command-text px-4 py-2"
        >
          <Icon name="material-symbols:create-new-folder" class="mr-2 w-5 h-5" />
          New Folder
        </button>
        <button 
          @click="showCreateFileDialog = true"
          class="command-text px-4 py-2"
        >
          <Icon name="material-symbols:note-add" class="mr-2 w-5 h-5" />
          New File
        </button>
        <button 
          @click="navigateUp"
          class="command-text px-4 py-2"
          :disabled="currentPath === '/'"
        >
          <Icon name="material-symbols:arrow-upward" class="mr-2 w-5 h-5" />
          Up
        </button>
        <button 
          @click="refresh"
          class="command-text px-4 py-2"
        >
          <Icon name="material-symbols:refresh" class="mr-2 w-5 h-5" />
          Refresh
        </button>
      </div>
    </div>

    <!-- Path Navigation -->
    <div class="bg-dark-accent/50 rounded-xl p-3 mb-4 flex items-center space-x-2 overflow-x-auto">
      <i class="fas fa-folder text-primary"></i>
      <div class="flex items-center space-x-2">
        <button 
          @click="navigateTo('/')"
          class="text-primary hover:text-primary/80 transition-colors"
        >
          root
        </button>
        <template v-for="(segment, index) in pathSegments" :key="index">
          <span class="text-gray-500">/</span>
          <button 
            @click="navigateToSegment(index)"
            class="text-primary hover:text-primary/80 transition-colors"
          >
            {{ segment }}
          </button>
        </template>
      </div>
    </div>

    <!-- File List -->
    <div class="bg-dark-accent/50 rounded-2xl border border-gray-700/30">
      <div class="grid grid-cols-12 gap-4 p-4 border-b border-gray-700/30 text-sm text-gray-400">
        <div class="col-span-6">Name</div>
        <div class="col-span-2">Size</div>
        <div class="col-span-2">Type</div>
        <div class="col-span-2">Actions</div>
      </div>

      <div class="divide-y divide-gray-700/30">
        <div 
          v-for="file in files" 
          :key="file.name"
          class="grid grid-cols-12 gap-4 p-4 text-sm hover:bg-white/5 transition-colors"
        >
          <div class="col-span-6 flex items-center space-x-3">
            <Icon 
              :name="getFileIcon(file.name, file.isDirectory)" 
              :class="getIconColor(file.name)"
              class="w-5 h-5"
            />
            <span 
              @click="file.isDirectory ? navigateTo(file.name) : openEditFileDialog(file)"
              class="truncate cursor-pointer hover:text-primary"
            >
              {{ file.name }}
            </span>
          </div>
          <div class="col-span-2 text-gray-400">
            {{ formatSize(file.size) }}
          </div>
          <div class="col-span-2 text-gray-400">
            {{ file.isDirectory ? 'Directory' : getFileType(file.name) }}
          </div>
          <div class="col-span-2 flex space-x-2">
            <button 
              @click="openRenameDialog(file)"
              class="p-1.5 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors"
              title="Rename"
            >
              <Icon name="material-symbols:edit" class="w-5 h-5" />
            </button>
            <button 
              @click="removeFile(file)"
              class="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Icon name="material-symbols:delete" class="w-5 h-5" />
            </button>
            <button 
              v-if="!file.isDirectory"
              @click="downloadFile(file)"
              class="p-1.5 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors"
              title="Download"
            >
              <Icon name="material-symbols:download" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Empty state -->
        <div 
          v-if="files.length === 0" 
          class="text-center py-12 text-gray-500"
        >
          <Icon name="material-symbols:folder-open" class="w-16 h-16 mb-3" />
          <div>This folder is empty</div>
          <div class="text-sm">No files or directories found</div>
        </div>
      </div>
    </div>

    <!-- Create Folder Dialog -->
    <Modal v-if="showCreateFolderDialog" @close="showCreateFolderDialog = false">
      <template #title>Create New Folder</template>
      <template #content>
        <input 
          v-model="newFolderName"
          type="text"
          class="w-full bg-dark-accent/50 rounded-lg border border-gray-700/30 px-4 py-2 text-gray-200"
          placeholder="Enter folder name"
          @keyup.enter="createFolder"
        />
      </template>
      <template #actions>
        <button 
          @click="createFolder"
          class="command-text"
        >
          Create
        </button>
      </template>
    </Modal>

    <!-- Create/Edit File Dialog -->
    <Modal 
      v-if="showCreateFileDialog || showEditFileDialog" 
      @close="closeFileDialog"
    >
      <template #title>{{ editingFile ? 'Edit File' : 'Create New File' }}</template>
      <template #content>
        <input 
          v-if="!editingFile"
          v-model="newFileName"
          type="text"
          class="w-full bg-dark-accent/50 rounded-lg border border-gray-700/30 px-4 py-2 text-gray-200 mb-4"
          placeholder="Enter file name"
        />
        <textarea 
          v-model="fileContent"
          class="w-full h-64 bg-dark-accent/50 rounded-lg border border-gray-700/30 px-4 py-2 text-gray-200 font-mono"
          placeholder="Enter file content"
        ></textarea>
      </template>
      <template #actions>
        <button 
          @click="saveFile"
          class="command-text"
        >
          {{ editingFile ? 'Save' : 'Create' }}
        </button>
      </template>
    </Modal>

    <!-- Rename Dialog -->
    <Modal v-if="showRenameDialog" @close="closeRenameDialog">
      <template #title>Rename {{ renamingFile?.name }}</template>
      <template #content>
        <input 
          v-model="newName"
          type="text"
          class="w-full bg-dark-accent/50 rounded-lg border border-gray-700/30 px-4 py-2 text-gray-200"
          placeholder="Enter new name"
          @keyup.enter="renameFile"
        />
      </template>
      <template #actions>
        <button 
          @click="renameFile"
          class="command-text"
        >
          Rename
        </button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSocket } from '@/composables/useSocket';
import Modal from './RenameModal.vue';

const socket = useSocket();
const files = ref([]);
const currentPath = ref('/');

// Dialog states
const showCreateFolderDialog = ref(false);
const showCreateFileDialog = ref(false);
const showEditFileDialog = ref(false);
const showRenameDialog = ref(false);

// Form states
const newFolderName = ref('');
const newFileName = ref('');
const fileContent = ref('');
const newName = ref('');
const editingFile = ref(null);
const renamingFile = ref(null);

// Compute path segments for breadcrumb navigation
const pathSegments = computed(() => {
  return currentPath.value.split('/').filter(Boolean);
});

// Format file size
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Navigation functions
function navigateTo(path) {
  const newPath = path.startsWith('/') ? path : `${currentPath.value}/${path}`;
  currentPath.value = newPath.replace(/\/+/g, '/');
  loadFiles();
}

function navigateToSegment(index) {
  const segments = pathSegments.value.slice(0, index + 1);
  navigateTo('/' + segments.join('/'));
}

function navigateUp() {
  const segments = pathSegments.value.slice(0, -1);
  navigateTo('/' + segments.join('/'));
}

// File operations
async function loadFiles() {
  socket.value.emit('browseFiles', currentPath.value);
}

function removeFile(file) {
  if (confirm(`Are you sure you want to delete ${file.name}?`)) {
    socket.value.emit('removeFile', {
      path: `${currentPath.value}/${file.name}`,
      isDirectory: file.isDirectory
    });
  }
}

function downloadFile(file) {
  // Implement file download logic
  console.log('Download file:', file.name);
}

function refresh() {
  loadFiles();
}

// New methods for file operations
async function createFolder() {
  if (!newFolderName.value) return;
  
  socket.value.emit('createFolder', {
    path: `${currentPath.value}/${newFolderName.value}`.replace(/\/+/g, '/')
  });
  
  showCreateFolderDialog.value = false;
  newFolderName.value = '';
}

async function saveFile() {
  const path = editingFile.value
    ? `${currentPath.value}/${editingFile.value.name}`
    : `${currentPath.value}/${newFileName.value}`;

  socket.value.emit('saveFile', {
    path: path.replace(/\/+/g, '/'),
    content: fileContent.value
  });

  closeFileDialog();
}

function openEditFileDialog(file) {
  editingFile.value = file;
  showEditFileDialog.value = true;
  
  // Load file content
  socket.value.emit('getFileContent', {
    path: `${currentPath.value}/${file.name}`.replace(/\/+/g, '/')
  });
}

function closeFileDialog() {
  showCreateFileDialog.value = false;
  showEditFileDialog.value = false;
  editingFile.value = null;
  newFileName.value = '';
  fileContent.value = '';
}

function openRenameDialog(file) {
  renamingFile.value = file;
  newName.value = file.name;
  showRenameDialog.value = true;
}

function closeRenameDialog() {
  showRenameDialog.value = false;
  renamingFile.value = null;
  newName.value = '';
}

async function renameFile() {
  if (!newName.value || !renamingFile.value) return;
  
  socket.value.emit('renameFile', {
    oldPath: `${currentPath.value}/${renamingFile.value.name}`.replace(/\/+/g, '/'),
    newPath: `${currentPath.value}/${newName.value}`.replace(/\/+/g, '/'),
    isDirectory: renamingFile.value.isDirectory
  });

  closeRenameDialog();
}

// Socket event handlers
onMounted(() => {
  socket.value.on('fileContent', ({ content }) => {
    fileContent.value = content;
  });

  socket.value.on('fileCreated', () => {
    loadFiles();
  });

  socket.value.on('fileRenamed', () => {
    loadFiles();
  });

  socket.value.on('folderCreated', () => {
    loadFiles();
  });

  socket.value.on('fileList', ({ files: newFiles }) => {
    files.value = newFiles;
  });

  socket.value.on('fileRemoved', () => {
    loadFiles();
  });

  // Initial load
  loadFiles();
});

// Add these helper functions
function getFileIcon(filename, isDirectory) {
  if (isDirectory) return 'material-symbols:folder';
  
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
      return 'logos:javascript';
    case 'css':
      return 'vscode-icons:file-type-css';
    case 'html':
      return 'vscode-icons:file-type-html';
    case 'json':
      return 'vscode-icons:file-type-json';
    case 'md':
      return 'vscode-icons:file-type-markdown';
    case 'txt':
      return 'material-symbols:description';
    case 'pdf':
      return 'vscode-icons:file-type-pdf2';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'material-symbols:image';
    default:
      return 'material-symbols:file-present';
  }
}

function getIconColor(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
      return 'text-yellow-400';
    case 'css':
      return 'text-blue-400';
    case 'html':
      return 'text-orange-400';
    case 'json':
      return 'text-green-400';
    case 'md':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
}

function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
      return 'JavaScript';
    case 'css':
      return 'CSS';
    case 'html':
      return 'HTML';
    case 'json':
      return 'JSON';
    case 'md':
      return 'Markdown';
    case 'txt':
      return 'Text';
    case 'pdf':
      return 'PDF';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'Image';
    default:
      return 'File';
  }
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

.command-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

</style>
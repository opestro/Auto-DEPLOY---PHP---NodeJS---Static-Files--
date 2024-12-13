import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { FileTracker } from '../../../src/fileTracker.js';
import { loadConfig } from '../../../src/config.js';
import { CommandRunner } from '../../../src/commandRunner.js';
import { FileManager } from './utils/FileManager.js';
import { IgnoreFileManager } from './utils/IgnoreFileManager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from './logger.js';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Global service instances
let services = {
  fileTracker: null,
  commandRunner: null,
  fileManager: null,
  config: null
};

function resolveLocalPath(filePath, config) {
  // If localPath is specified in config, use it as base
  if (config.localPath) {
    // Remove 'Project/' prefix if it exists
    const cleanPath = filePath.replace(/^Project\//, '');
    return path.join(process.cwd(), config.localPath, cleanPath);
  }
  // Otherwise use project root
  return path.join(process.cwd(), filePath);
}

async function initializeServices() {
  try {
    // Load config first
    services.config = await loadConfig();
    if (!services.config) throw new Error('Configuration not found');

    // Initialize FileTracker with the correct base path
    const basePath = services.config.localPath 
      ? path.join(process.cwd(), services.config.localPath)
      : process.cwd();

    services.fileTracker = new FileTracker(basePath);

    // Initialize ignore patterns
    const ignoreManager = new IgnoreFileManager(process.cwd());
    const ignorePatterns = await ignoreManager.readIgnoreFile();

    // Initialize CommandRunner
    services.commandRunner = new CommandRunner(
      services.config.localPath, 
      services.config.remotePath
    );

    // Initialize SSH config
    const sshConfig = {
      host: services.config.host,
      port: services.config.port || 22,
      username: services.config.username,
      remotePath: services.config.remotePath
    };

    // Handle authentication
    if (services.config.privateKey) {
      const privateKeyPath = path.resolve(process.cwd(), services.config.privateKey);
      sshConfig.privateKey = await fs.readFile(privateKeyPath, 'utf8');
      if (services.config.passphrase) {
        sshConfig.passphrase = services.config.passphrase;
      }
    } else if (services.config.password) {
      sshConfig.password = services.config.password;
    }

    // Initialize FileManager
    services.fileManager = new FileManager(sshConfig);
    
    // Test connection
    await services.fileManager.connect();
    
    logger.info('All services initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

// API Routes
app.get('/api/config', async (req, res) => {
  try {
    res.json(services.config || await loadConfig());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    if (!services.fileManager) {
      await initializeServices();
    }
    const files = await services.fileManager.listFiles('/');
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Ensure services are initialized
  if (!services.fileManager) {
    try {
      await initializeServices();
    } catch (error) {
      socket.emit('error', { message: error.message });
      return;
    }
  }

  socket.on('deployFiles', async () => {
    try {
      if (!services.fileTracker || !services.fileManager) {
        await initializeServices();
      }

      // Start deployment
      const startLog = logger.deploymentStart('files');
      socket.emit('log', startLog);

      const { deployableFiles } = await services.fileTracker.getDeployableFiles();
      const total = deployableFiles.length;
      let processed = 0;

      for (const relativePath of deployableFiles) {
        try {
          // Emit uploading status
          const uploadLog = logger.info(`${relativePath}: uploading`);
          socket.emit('log', uploadLog);

          const fullPath = resolveLocalPath(relativePath, services.config);
          
          if (await fs.pathExists(fullPath)) {
            await services.fileManager.uploadFile(fullPath, relativePath);
            processed++;

            // Emit completion status
            const completionLog = logger.success(`${relativePath}: completed`);
            socket.emit('log', completionLog);
          }
        } catch (error) {
          const errorLog = logger.error(`Failed to deploy ${relativePath}: ${error.message}`);
          socket.emit('log', errorLog);
        }
      }

      const { newHashes } = await services.fileTracker.findChangedFiles();
      await services.fileTracker.updateTrackedFiles(newHashes);

      // Final completion logs
      const summaryLog = logger.success(`Deployment completed: ${processed}/${total} files`);
      const completionLog = logger.success('files deployment completed');
      
      socket.emit('log', summaryLog);
      socket.emit('log', completionLog);

      // Update deployment status
      socket.emit('deploymentStatus', { 
        status: 'completed', 
        type: 'files',
        processed,
        total
      });

    } catch (error) {
      const errorLog = logger.error('Deployment error:', error);
      socket.emit('log', errorLog);
      socket.emit('deploymentStatus', {
        status: 'failed',
        type: 'files',
        error: error.message
      });
    }
  });

  socket.on('browseFiles', async (requestedPath = '/') => {
    try {
      if (!services.fileManager) {
        await initializeServices();
      }

      logger.info(`Browsing files in: ${requestedPath}`);
      const files = await services.fileManager.listFiles(requestedPath);
      socket.emit('fileList', { files });
    } catch (error) {
      logger.error('Error browsing files:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('createFolder', async ({ path }) => {
    try {
      if (!services.fileManager) await initializeServices();
      
      logger.info(`Creating folder: ${path}`);
      await services.fileManager.createFolder(path);
      socket.emit('folderCreated');
    } catch (error) {
      logger.error('Error creating folder:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('saveFile', async ({ path, content }) => {
    try {
      if (!services.fileManager) await initializeServices();
      
      logger.info(`Saving file: ${path}`);
      await services.fileManager.saveFile(path, content);
      socket.emit('fileCreated');
    } catch (error) {
      logger.error('Error saving file:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('getFileContent', async ({ path }) => {
    try {
      if (!services.fileManager) await initializeServices();
      
      logger.info(`Reading file: ${path}`);
      const content = await services.fileManager.getFileContent(path);
      socket.emit('fileContent', { content });
    } catch (error) {
      logger.error('Error reading file:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('renameFile', async ({ oldPath, newPath, isDirectory }) => {
    try {
      if (!services.fileManager) await initializeServices();
      
      logger.info(`Renaming ${isDirectory ? 'folder' : 'file'}: ${oldPath} -> ${newPath}`);
      await services.fileManager.rename(oldPath, newPath);
      socket.emit('fileRenamed');
    } catch (error) {
      logger.error('Error renaming file:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('removeFile', async ({ path, isDirectory }) => {
    try {
      if (!services.fileManager) await initializeServices();
      
      logger.info(`Removing ${isDirectory ? 'folder' : 'file'}: ${path}`);
      await services.fileManager.remove(path, isDirectory);
      socket.emit('fileRemoved');
    } catch (error) {
      logger.error('Error removing file:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('executeCommands', async (data) => {
    try {
      if (!services.fileManager || !services.commandRunner) {
        await initializeServices();
      }

      // Start command execution
      const startLog = logger.info('Starting command execution...');
      socket.emit('log', startLog);

      const result = await services.commandRunner.executeCommands(
        services.fileManager.getConnection(),
        {
          useFile: data.useFile,
          directCommands: data.commands,
          onProgress: (progressData) => {
            // Emit progress updates
            socket.emit('commandProgress', progressData);
            
            // Also emit as logs
            const log = logger[progressData.type](
              progressData.message,
              null,
              progressData.command,
              progressData.output
            );
            socket.emit('log', log);
          }
        }
      );

      if (result.success) {
        const successLog = logger.success('All commands executed successfully');
        socket.emit('log', successLog);
      } else {
        const errorLog = logger.error('Command execution failed');
        socket.emit('log', errorLog);
      }

      socket.emit('deploymentStatus', {
        status: result.success ? 'completed' : 'failed',
        type: 'commands'
      });

    } catch (error) {
      const errorLog = logger.error('Command execution error:', error);
      socket.emit('log', errorLog);
      socket.emit('deploymentStatus', {
        status: 'failed',
        type: 'commands',
        error: error.message
      });
    }
  });

  // ... rest of your socket handlers ...
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    if (services.fileManager) {
      await services.fileManager.disconnect();
    }
    httpServer.close();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  process.exit();
});
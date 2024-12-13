import { NodeSSH } from 'node-ssh';
import path from 'path';

export class FileManager {
  constructor(config) {
    this.config = config;
    this.ssh = new NodeSSH();
    this.connected = false;
  }

  async connect() {
    if (!this.connected) {
      try {
        const sshConfig = {
          host: this.config.host,
          port: this.config.port || 22,
          username: this.config.username
        };

        if (this.config.privateKey) {
          sshConfig.privateKey = this.config.privateKey;
          if (this.config.passphrase) {
            sshConfig.passphrase = this.config.passphrase;
          }
        } else if (this.config.password) {
          sshConfig.password = this.config.password;
        }

        await this.ssh.connect(sshConfig);
        this.connected = true;
      } catch (error) {
        console.error('SSH connection error:', error);
        throw new Error(`Failed to connect: ${error.message}`);
      }
    }
  }

  getConnection() {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }
    return this.ssh;
  }

  async listFiles(dirPath = '/') {
    try {
      await this.connect();
      
      // Normalize the remote path
      const remotePath = path.posix.join(this.config.remotePath || '/', dirPath)
        .replace(/\\/g, '/');

      // Use ls -la with custom format for better parsing
      const command = `ls -la --time-style="+%Y-%m-%d %H:%M" "${remotePath}"`;
      const result = await this.ssh.execCommand(command);
      
      if (result.stderr && !result.stdout) {
        throw new Error(result.stderr);
      }

      // Parse ls output
      const lines = result.stdout.split('\n');
      const files = [];

      for (const line of lines) {
        if (!line.trim() || line.startsWith('total')) continue;

        // Parse ls output with fixed positions
        const match = line.match(/^([drwx-]{10})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/);

        if (match) {
          const [, perms, links, owner, group, size, dateStr, name] = match;

          // Skip . and .. if not in root
          if ((name === '.' || name === '..') && dirPath !== '/') continue;

          const isDirectory = perms.startsWith('d');
          const filePath = path.posix.join(dirPath, name);

          files.push({
            name,
            path: filePath,
            isDirectory,
            size: parseInt(size, 10),
            owner,
            group,
            permissions: perms,
            modified: dateStr,
            type: isDirectory ? 'directory' : this.getFileType(name),
            icon: this.getFileIcon(name, isDirectory)
          });
        }
      }

      // Sort: directories first, then files alphabetically
      return files.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

    } catch (error) {
      console.error('Error listing remote files:', error);
      throw new Error(`Failed to list remote files: ${error.message}`);
    }
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.md': return 'markdown';
      case '.js': return 'javascript';
      case '.json': return 'json';
      case '.html': return 'html';
      case '.css': return 'css';
      case '.txt': return 'text';
      case '.env': return 'env';
      default: return 'file';
    }
  }

  getFileIcon(filename, isDirectory) {
    if (isDirectory) return '📁';
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.md': return '📝';
      case '.js': return '📜';
      case '.json': return '📋';
      case '.html': return '📄';
      case '.css': return '📄';
      case '.txt': return '📄';
      case '.env': return '📄';
      default: return '📄';
    }
  }

  async getFileContent(filePath) {
    try {
      await this.connect();
      
      const remotePath = path.posix.join(this.config.remotePath || '/', filePath)
        .replace(/\\/g, '/');
      
      const result = await this.ssh.execCommand('cat ' + remotePath);
      
      if (result.stderr) {
        throw new Error(result.stderr);
      }
      
      return result.stdout;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async removeFile(filePath) {
    try {
      await this.connect();
      const remotePath = path.join(this.config.remotePath || '/', filePath)
        .replace(/\\/g, '/');
      
      const result = await this.ssh.execCommand('rm ' + remotePath);
      if (result.stderr) {
        throw new Error(result.stderr);
      }
    } catch (error) {
      throw new Error(`Failed to remove file: ${error.message}`);
    }
  }

  async removeDirectory(dirPath) {
    try {
      await this.connect();
      const remotePath = path.join(this.config.remotePath || '/', dirPath)
        .replace(/\\/g, '/');
      
      const result = await this.ssh.execCommand('rm -rf ' + remotePath);
      if (result.stderr) {
        throw new Error(result.stderr);
      }
    } catch (error) {
      throw new Error(`Failed to remove directory: ${error.message}`);
    }
  }

  async createDirectory(dirPath) {
    try {
      await this.connect();
      const remotePath = path.join(this.config.remotePath || '/', dirPath)
        .replace(/\\/g, '/');
      
      const result = await this.ssh.execCommand('mkdir -p ' + remotePath);
      if (result.stderr) {
        throw new Error(result.stderr);
      }
    } catch (error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.ssh.dispose();
      this.connected = false;
    }
  }

  async uploadFile(localPath, remotePath) {
    try {
      await this.connect();

      const remoteFilePath = path.join(this.config.remotePath || '/', remotePath)
        .replace(/\\/g, '/');
      
      const remoteDir = path.dirname(remoteFilePath);
      await this.ssh.execCommand(`mkdir -p "${remoteDir}"`);

      await this.ssh.putFile(localPath, remoteFilePath);

    } catch (error) {
      throw new Error(`Failed to upload file ${remotePath}: ${error.message}`);
    }
  }

  async uploadDirectory(localPath, remotePath) {
    try {
      await this.connect();

      const remoteDir = path.join(this.config.remotePath || '/', remotePath)
        .replace(/\\/g, '/');
      
      await this.ssh.execCommand(`mkdir -p "${remoteDir}"`);

      await this.ssh.putDirectory(localPath, remoteDir, {
        recursive: true,
        concurrency: 10,
        validate: (itemPath) => {
          const baseName = path.basename(itemPath);
          return baseName.charAt(0) !== '.';
        }
      });

    } catch (error) {
      throw new Error(`Failed to upload directory ${remotePath}: ${error.message}`);
    }
  }

  async createFolder(folderPath) {
    try {
      await this.connect();
      const remotePath = path.posix.join(this.config.remotePath || '/', folderPath)
        .replace(/\\/g, '/');
      
      await this.ssh.execCommand(`mkdir -p "${remotePath}"`);
    } catch (error) {
      throw new Error(`Failed to create folder ${folderPath}: ${error.message}`);
    }
  }

  async saveFile(filePath, content) {
    try {
      await this.connect();
      const remotePath = path.posix.join(this.config.remotePath || '/', filePath)
        .replace(/\\/g, '/');
      
      // Create parent directories if they don't exist
      const dirPath = path.dirname(remotePath);
      await this.ssh.execCommand(`mkdir -p "${dirPath}"`);
      
      // Write file content
      await this.ssh.execCommand(`cat > "${remotePath}"`, {
        stdin: content
      });
    } catch (error) {
      throw new Error(`Failed to save file ${filePath}: ${error.message}`);
    }
  }

  async rename(oldPath, newPath) {
    try {
      await this.connect();
      const remoteOldPath = path.posix.join(this.config.remotePath || '/', oldPath)
        .replace(/\\/g, '/');
      const remoteNewPath = path.posix.join(this.config.remotePath || '/', newPath)
        .replace(/\\/g, '/');
      
      await this.ssh.execCommand(`mv "${remoteOldPath}" "${remoteNewPath}"`);
    } catch (error) {
      throw new Error(`Failed to rename ${oldPath}: ${error.message}`);
    }
  }

  async remove(filePath, isDirectory) {
    try {
      await this.connect();
      const remotePath = path.posix.join(this.config.remotePath || '/', filePath)
        .replace(/\\/g, '/');
      
      const command = isDirectory ? `rm -rf "${remotePath}"` : `rm "${remotePath}"`;
      await this.ssh.execCommand(command);
    } catch (error) {
      throw new Error(`Failed to remove ${filePath}: ${error.message}`);
    }
  }
} 
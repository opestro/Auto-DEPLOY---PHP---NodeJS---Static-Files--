import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import {glob} from 'glob';
import { IgnoreHandler } from './ignoreHandler.js';

export class FileTracker {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.deployFolder = path.join(this.projectPath, '.cscc-deploy');
    this.trackFile = path.join(this.deployFolder, 'file-hashes.json');
    this.configFile = path.join(this.deployFolder, 'config.json');
    this.ignoreHandler = new IgnoreHandler(projectPath);
  }

  async calculateFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex');
  }

  async loadTrackedFiles() {
    try {
      await fs.ensureDir(this.deployFolder);
      const exists = await fs.pathExists(this.trackFile);
      return exists ? await fs.readJSON(this.trackFile) : {};
    } catch (error) {
      return {};
    }
  }

  async saveTrackedFiles(hashes) {
    await fs.ensureDir(this.deployFolder);
    await fs.writeJSON(this.trackFile, hashes, { spaces: 2 });
  }

  async shouldIgnoreFile(filePath) {
    await this.ignoreHandler.loadIgnoreFile();
    return this.ignoreHandler.isIgnored(filePath);
  }

  async findChangedFiles() {
    await this.ignoreHandler.loadIgnoreFile();
    const oldHashes = await this.loadTrackedFiles();
    const newHashes = {};
    const changedFiles = [];
    const ignoredFiles = [];

    const files = glob.sync('**/*', {
      cwd: this.projectPath,
      nodir: true,
      dot: true,
      ignore: [
        'node_modules/**',
        '.git/**',
        '.cscc-deploy/**'
      ]
    });

    for (const file of files) {
      const normalizedPath = file.split(path.sep).join('/');
      
      const isIgnored = await this.shouldIgnoreFile(normalizedPath);
      
      if (isIgnored) {
        ignoredFiles.push(normalizedPath);
        continue;
      }

      const fullPath = path.join(this.projectPath, file);
      
      try {
        const hash = await this.calculateFileHash(fullPath);
        newHashes[normalizedPath] = hash;

        if (!oldHashes[normalizedPath] || oldHashes[normalizedPath] !== hash) {
          changedFiles.push(normalizedPath);
        }
      } catch (error) {
        console.warn(`Warning: Could not process file ${file}: ${error.message}`);
      }
    }

    return {
      changedFiles,
      ignoredFiles,
      newHashes
    };
  }

  async getDeployableFiles() {
    const { changedFiles, ignoredFiles, newHashes } = await this.findChangedFiles();
    
    const deployableFiles = changedFiles.filter(async (file) => {
      const shouldIgnore = await this.shouldIgnoreFile(file);
      return !shouldIgnore;
    });

    return {
      deployableFiles,
      ignoredFiles,
      newHashes
    };
  }

  async updateTrackedFiles(hashes) {
    await this.saveTrackedFiles(hashes);
  }

  async saveConfig(config) {
    await fs.ensureDir(this.deployFolder);
    await fs.writeJSON(this.configFile, config, { spaces: 2 });
  }

  async loadConfig() {
    try {
      await fs.ensureDir(this.deployFolder);
      const exists = await fs.pathExists(this.configFile);
      return exists ? await fs.readJSON(this.configFile) : null;
    } catch (error) {
      return null;
    }
  }
} 
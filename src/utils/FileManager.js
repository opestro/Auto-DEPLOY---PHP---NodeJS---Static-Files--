import fs from 'fs-extra';
import path from 'path';
import { loadConfig } from '../config.js';

export class FileManager {
    constructor() {
        this.config = null;
        this.initialize();
    }

    async initialize() {
        this.config = await loadConfig();
        if (!this.config) {
            throw new Error('No configuration found. Please run deploy first.');
        }
    }

    async listFiles(dirPath) {
        const fullPath = path.join(this.config.remotePath, dirPath);
        const files = await fs.readdir(fullPath);
        
        const fileList = await Promise.all(files.map(async file => {
            const filePath = path.join(fullPath, file);
            const stats = await fs.stat(filePath);
            
            return {
                name: file,
                isDirectory: stats.isDirectory(),
                children: stats.isDirectory() ? await this.listFiles(path.join(dirPath, file)) : null
            };
        }));

        return fileList.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });
    }

    async removeFile(filePath) {
        const fullPath = path.join(this.config.remotePath, filePath);
        await fs.remove(fullPath);
    }

    async removeDirectory(dirPath) {
        const fullPath = path.join(this.config.remotePath, dirPath);
        await fs.remove(fullPath);
    }

    async copyFile(src, dest) {
        const fullSrc = path.join(this.config.remotePath, src);
        const fullDest = path.join(this.config.remotePath, dest);
        await fs.copy(fullSrc, fullDest);
    }

    async moveFile(src, dest) {
        const fullSrc = path.join(this.config.remotePath, src);
        const fullDest = path.join(this.config.remotePath, dest);
        await fs.move(fullSrc, fullDest);
    }

    async isDirectory(dirPath) {
        try {
            const fullPath = path.join(this.config.remotePath, dirPath);
            const stats = await fs.stat(fullPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }
} 
import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';

export class IgnoreFileManager {
  constructor(basePath) {
    this.basePath = basePath;
    this.ignoreFile = path.join(basePath, '.cscc-ignore');
    this.defaultPatterns = [
      'node_modules',
      '.git',
      '.env',
      '*.log',
      'dist',
      'build',
      '.DS_Store',
      'thumbs.db'
    ];
  }

  async readIgnoreFile() {
    try {
      // Create ignore instance with default patterns
      const ig = ignore().add(this.defaultPatterns);

      // Read custom patterns if ignore file exists
      if (await fs.pathExists(this.ignoreFile)) {
        const content = await fs.readFile(this.ignoreFile, 'utf8');
        const customPatterns = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        
        ig.add(customPatterns);
      } else {
        // Create default ignore file if it doesn't exist
        await this.createDefaultIgnoreFile();
      }

      return ig;
    } catch (error) {
      console.error('Error reading ignore file:', error);
      return ignore().add(this.defaultPatterns);
    }
  }

  async createDefaultIgnoreFile() {
    try {
      const content = [
        '# Default ignore patterns',
        ...this.defaultPatterns.map(pattern => `${pattern}`),
        '',
        '# Custom ignore patterns',
        '# Add your custom patterns below',
        ''
      ].join('\n');

      await fs.writeFile(this.ignoreFile, content, 'utf8');
    } catch (error) {
      console.error('Error creating default ignore file:', error);
    }
  }

  async updateIgnoreFile(patterns) {
    try {
      const content = patterns.join('\n');
      await fs.writeFile(this.ignoreFile, content, 'utf8');
    } catch (error) {
      console.error('Error updating ignore file:', error);
      throw new Error(`Failed to update ignore file: ${error.message}`);
    }
  }
} 
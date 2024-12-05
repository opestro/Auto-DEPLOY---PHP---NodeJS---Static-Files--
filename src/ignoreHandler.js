import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';
import chalk from 'chalk';

export class IgnoreHandler {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.possiblePaths = [
      path.join(projectPath, '.cscc-ignore'),
    ];
    this.ignoreFile = this.possiblePaths[0];
    this.ig = ignore();
    
    this.defaultPatterns = [
      'node_modules/**',
      '.git/**',
      '.cscc-deploy/**',
      '.cscc-ignore'
    ];
  }

  async loadIgnoreFile() {
    try {
      this.ig = ignore();
      this.ig.add(this.defaultPatterns);
      await this.createDefaultIgnoreFile();

      if (await fs.pathExists(this.ignoreFile)) {
        const content = await fs.readFile(this.ignoreFile, 'utf8');
        const patterns = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        
        this.ig.add(patterns);
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error loading .cscc-ignore file'), error);
    }
  }

  async createDefaultIgnoreFile() {
    try {
      if (!(await fs.pathExists(this.ignoreFile))) {
        const content = `# CSCC Auto-Deploy Ignore File
# Lines starting with # are comments

# System and temporary files
.DS_Store
thumbs.db
*.log
.env

# Add your custom ignore patterns below
# Example: page1.html
`;
        await fs.writeFile(this.ignoreFile, content);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating .cscc-ignore file:', error);
      return false;
    }
  }

  isIgnored(filePath) {
    const relativePath = path.relative(this.projectPath, 
      path.resolve(this.projectPath, filePath));
    
    const normalizedPath = relativePath.split(path.sep).join('/');
    return this.ig.ignores(normalizedPath);
  }
} 
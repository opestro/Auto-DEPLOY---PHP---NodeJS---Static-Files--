import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';
import chalk from 'chalk';

export class IgnoreHandler {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.ignoreFile = path.join(projectPath, '.cscc-ignore');
    this.ig = ignore();
    
    this.defaultPatterns = [
      'node_modules/**',
      '.git/**',
      '.cscc-deploy/**',
      '.DS_Store',
      'thumbs.db',
      '*.log',
      '.env'
    ];
  }

  async loadIgnoreFile() {
    try {
      this.ig.add(this.defaultPatterns);

      if (await fs.pathExists(this.ignoreFile)) {
        const content = await fs.readFile(this.ignoreFile, 'utf8');
        const patterns = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        
        this.ig.add(patterns);
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Error loading .cscc-ignore file'));
    }
  }

  isIgnored(filePath) {
    const relativePath = path.relative(this.projectPath, 
      path.resolve(this.projectPath, filePath));
    
    const normalizedPath = relativePath.split(path.sep).join('/');
    
    return this.ig.ignores(normalizedPath);
  }

  async createDefaultIgnoreFile() {
    if (!(await fs.pathExists(this.ignoreFile))) {
      const content = `# CSCC Auto-Deploy Ignore File
# Ignore node modules
node_modules/

# Ignore version control
.git/

# Ignore CSCC deploy files
.cscc-deploy/

# Ignore system files
.DS_Store
thumbs.db

# Ignore logs
*.log

# Ignore environment files
.env

# Add your custom ignore patterns below
# Example:
# dist/
# build/
# *.tmp
`;
      await fs.writeFile(this.ignoreFile, content);
      return true;
    }
    return false;
  }
} 
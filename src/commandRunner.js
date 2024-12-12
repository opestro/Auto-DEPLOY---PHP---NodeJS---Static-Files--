import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export class CommandRunner {
    constructor(localPath, remotePath) {
        this.localPath = localPath;
        this.remotePath = remotePath;
        this.commandsFile = path.resolve(process.cwd(), '.deploycommands');
    }

    parseDockerLikeCommands(content) {
        const lines = content.split('\n');
        const commands = [];
        let lineNumber = 0;
        
        for (const line of lines) {
            lineNumber++;
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            try {
                // Parse Docker-like commands
                if (trimmed.startsWith('RUN ')) {
                    commands.push({
                        type: 'run',
                        command: trimmed.substring(4).trim(),
                        line: lineNumber
                    });
                } else if (trimmed.startsWith('WORKDIR ')) {
                    commands.push({
                        type: 'workdir',
                        command: `cd "${trimmed.substring(8).trim()}"`,
                        line: lineNumber
                    });
                } else if (trimmed.startsWith('COPY ')) {
                    const [_, src, dest] = trimmed.split(' ').map(p => p.trim());
                    commands.push({
                        type: 'copy',
                        command: `cp -r "${src}" "${dest}"`,
                        src,
                        dest,
                        line: lineNumber
                    });
                } else if (trimmed.startsWith('MOVE ')) {
                    const [_, src, dest] = trimmed.split(' ').map(p => p.trim());
                    commands.push({
                        type: 'move',
                        command: `mv "${src}" "${dest}"`,
                        src,
                        dest,
                        line: lineNumber
                    });
                }
            } catch (error) {
                console.error(chalk.red(`Error parsing line ${lineNumber}: ${error.message}`));
            }
        }
        
        return commands;
    }

    async loadCommands() {
        try {
            if (await fs.pathExists(this.commandsFile)) {
                const content = await fs.readFile(this.commandsFile, 'utf8');
                return this.parseDockerLikeCommands(content);
            }
            return [];
        } catch (error) {
            console.error(chalk.red('Error reading .deploycommands file:', error.message));
            return [];
        }
    }

    async executeCommands(connection, options = {}) {
        const {
            isSSH = true,
            useFile = true,
            directCommands = '',
            onProgress = () => {}
        } = options;

        // Load commands from file or direct input
        const commands = useFile ? 
            await this.loadCommands() : 
            this.parseDockerLikeCommands(directCommands);

        if (!commands.length) {
            onProgress({
                type: 'info',
                message: 'No commands to execute'
            });
            return { success: true, results: [] };
        }

        if (!isSSH) {
            onProgress({
                type: 'error',
                message: 'Command execution not supported over FTP'
            });
            return { success: false, results: [] };
        }

        const results = [];
        const totalCommands = commands.length;

        try {
            // First, ensure we're in the remote path
            onProgress({
                type: 'info',
                message: `Changing to directory: ${this.remotePath}`,
                progress: 0
            });

            await connection.execCommand(`cd "${this.remotePath}"`);

            // Execute each command sequentially
            for (let i = 0; i < commands.length; i++) {
                const cmd = commands[i];
                const progress = ((i + 1) / totalCommands) * 100;

                onProgress({
                    type: 'info',
                    message: `Executing: ${cmd.command}`,
                    progress,
                    command: cmd
                });
                
                const result = await connection.execCommand(cmd.command, {
                    cwd: this.remotePath,
                    stream: 'both'
                });

                const success = result.code === 0;
                const output = result.stdout || result.stderr;

                results.push({
                    ...cmd,
                    success,
                    output
                });

                onProgress({
                    type: success ? 'success' : 'error',
                    message: success ? 
                        `Completed: ${cmd.command}` : 
                        `Failed: ${cmd.command}`,
                    output,
                    progress,
                    command: cmd
                });

                if (!success) break;
            }

            const success = results.every(r => r.success);
            onProgress({
                type: success ? 'success' : 'error',
                message: success ? 
                    'All commands executed successfully' : 
                    'Some commands failed',
                progress: 100
            });

            return { success, results };

        } catch (error) {
            onProgress({
                type: 'error',
                message: `Command execution failed: ${error.message}`,
                progress: 100
            });
            return { success: false, results };
        }
    }

    static async createTemplate(localPath) {
        const templatePath = path.join(localPath, '.deploycommands');
        const template = `# Deployment commands in Docker-like syntax
# Commands will be executed in order in the remote directory

# Change working directory if needed
WORKDIR ./adem

# Run git commands
RUN git clone https://github.com/opestro/csdeploy-landingPage.git

# Copy or move files to public_html
COPY ./csdeploy-landingPage/* ./public_html/
# Or use MOVE to move instead of copy
# MOVE ./csdeploy-landingPage/* ./public_html/

# Setup commands (uncomment if needed)
# RUN cd public_html
# RUN npm install
# RUN npm run build
`;
        
        try {
            await fs.writeFile(templatePath, template);
            return true;
        } catch (error) {
            console.error(chalk.red('Error creating .deploycommands template:', error.message));
            return false;
        }
    }
}

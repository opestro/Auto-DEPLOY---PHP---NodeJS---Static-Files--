import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class CommandRunner {
    constructor(localPath, remotePath) {
        this.localPath = localPath;
        this.remotePath = remotePath;
        this.commandsFile = path.resolve(process.cwd(), '.deploycommands');
    }

    parseDockerLikeCommands(content) {
        const lines = content.split('\n');
        const commands = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Parse Docker-like commands
            if (trimmed.startsWith('RUN ')) {
                commands.push(trimmed.substring(4));
            } else if (trimmed.startsWith('WORKDIR ')) {
                commands.push(`cd ${trimmed.substring(8)}`);
            } else if (trimmed.startsWith('COPY ')) {
                // Convert COPY to cp -r command
                const [_, src, dest] = trimmed.split(' ');
                commands.push(`cp -r ${src} ${dest}`);
            } else if (trimmed.startsWith('MOVE ')) {
                // Convert MOVE to mv command
                const [_, src, dest] = trimmed.split(' ');
                commands.push(`mv ${src} ${dest}`);
            }
        }
        
        return commands;
    }

    async loadCommands() {
        try {
            if (await fs.pathExists(this.commandsFile)) {
                const content = await fs.readFile(this.commandsFile, 'utf8');
                return this.parseDockerLikeCommands(content).join(' && ');
            }
            return '';
        } catch (error) {
            console.error(chalk.red('Error reading .deploycommands file:', error.message));
            return '';
        }
    }

    async executeCommands(connection, isSSH = true) {
        const commands = await this.loadCommands();
        if (!commands) {
            return { success: true, message: 'No commands to execute' };
        }

        if (isSSH) {
            try {
                // Execute commands directly in the remote directory
                const cdCommand = `cd "${this.remotePath}"`;
                const result = await connection.execCommand(`${cdCommand} && ${commands}`);
                
                return {
                    success: result.code === 0,
                    results: [{
                        command: 'Deployment Commands',
                        success: result.code === 0,
                        output: result.stdout || result.stderr
                    }]
                };
            } catch (error) {
                return {
                    success: false,
                    results: [{
                        command: 'Deployment Commands',
                        success: false,
                        output: error.message
                    }]
                };
            }
        } else {
            console.log(chalk.yellow('Warning: Command execution over FTP is limited. Use SSH for full command support.'));
            return {
                success: false,
                results: [{
                    command: 'Deployment Commands',
                    success: false,
                    output: 'Command execution not supported over FTP'
                }]
            };
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

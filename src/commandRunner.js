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
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Parse Docker-like commands
            if (trimmed.startsWith('RUN ')) {
                commands.push({
                    type: 'run',
                    command: trimmed.substring(4).trim()
                });
            } else if (trimmed.startsWith('WORKDIR ')) {
                commands.push({
                    type: 'workdir',
                    command: `cd "${trimmed.substring(8).trim()}"`
                });
            } else if (trimmed.startsWith('COPY ')) {
                const [_, src, dest] = trimmed.split(' ').map(p => p.trim());
                commands.push({
                    type: 'copy',
                    command: `cp -r "${src}" "${dest}"`
                });
            } else if (trimmed.startsWith('MOVE ')) {
                const [_, src, dest] = trimmed.split(' ').map(p => p.trim());
                commands.push({
                    type: 'move',
                    command: `mv "${src}" "${dest}"`
                });
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

    async executeCommands(connection, isSSH = true) {
        const commands = await this.loadCommands();
        if (!commands.length) {
            return { 
                success: true, 
                results: [{
                    command: 'No commands',
                    success: true,
                    output: 'No commands to execute'
                }]
            };
        }

        if (!isSSH) {
            console.log(chalk.yellow('Warning: Command execution over FTP is limited. Use SSH for full command support.'));
            return {
                success: false,
                results: [{
                    command: 'Commands',
                    success: false,
                    output: 'Command execution not supported over FTP'
                }]
            };
        }

        const results = [];
        const spinner = ora('Executing commands...').start();

        try {
            // First, ensure we're in the remote path
            spinner.text = `Changing to directory: ${this.remotePath}`;
            await connection.execCommand(`cd "${this.remotePath}"`);

            // Execute each command sequentially
            for (const cmd of commands) {
                spinner.text = `Executing: ${cmd.command}`;
                
                const result = await connection.execCommand(cmd.command, {
                    cwd: this.remotePath,
                    stream: 'both'
                });

                results.push({
                    type: cmd.type,
                    command: cmd.command,
                    success: result.code === 0,
                    output: result.stdout || result.stderr
                });

                if (result.code !== 0) {
                    spinner.fail(`Command failed: ${cmd.command}`);
                    console.error(chalk.red('Error output:'), result.stderr);
                    break;
                } else {
                    spinner.succeed(`Completed: ${cmd.command}`);
                    if (result.stdout) {
                        console.log(chalk.gray(result.stdout));
                    }
                }
            }

            spinner.stop();
            
            const success = results.every(r => r.success);
            if (success) {
                console.log(chalk.green('\n✔ All commands executed successfully'));
            } else {
                console.log(chalk.red('\n✖ Some commands failed'));
            }

            return {
                success,
                results
            };

        } catch (error) {
            spinner.fail('Command execution failed');
            return {
                success: false,
                results: [{
                    command: 'Commands',
                    success: false,
                    output: error.message
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

import inquirer from 'inquirer';
import { NodeSSH } from 'node-ssh';
import * as ftp from 'basic-ftp';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import { loadConfig } from '../config.js';
import { homedir } from 'os';
import path from 'path';

export async function browse() {
    const config = await loadConfig();
    if (!config) {
        console.log(chalk.yellow('No configuration found. Please run deploy first.'));
        return;
    }

    let currentPath = config.remotePath || '/';
    let client;

    const spinner = ora('Connecting to server...').start();

    try {
        if (config.type === 'FTP') {
            client = new ftp.Client();
            await client.access({
                host: config.host,
                user: config.username,
                password: config.password,
                secure: config.secure
            });
        } else {
            // Handle SSH connection with proper key resolution
            client = new NodeSSH();
            
            // Resolve private key path
            let privateKey = config.privateKey;
            if (privateKey.startsWith('~')) {
                privateKey = privateKey.replace('~', homedir());
            }
            privateKey = path.resolve(privateKey);

            // Read the private key file
            try {
                privateKey = await fs.readFile(privateKey, 'utf8');
            } catch (error) {
                spinner.fail(`Failed to read private key: ${error.message}`);
                return;
            }

            // Connect with SSH
            await client.connect({
                host: config.host,
                username: config.username,
                privateKey: privateKey,
                passphrase: config.passphrase,
                tryKeyboard: true,
                onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
                        finish([config.password]);
                    }
                }
            });
        }

        spinner.succeed('Connected to server');
        console.log(chalk.cyan('\nEnter commands or type "help" for available commands'));
        console.log(chalk.cyan('Current path:', currentPath));

        // Start interactive mode
        while (true) {
            const { command } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'command',
                    message: chalk.green('➜'),
                    prefix: ''
                }
            ]);

            const [cmd, ...args] = command.trim().split(' ');

            switch (cmd.toLowerCase()) {
                case 'ls':
                    await listFiles(client, currentPath, config.type);
                    break;

                case 'cd':
                    currentPath = await changeDirectory(client, currentPath, args[0], config.type);
                    break;

                case 'rmv':
                    await removeFile(client, currentPath, args, config.type);
                    break;

                case 'cp':
                    await copyFile(client, currentPath, args, config.type);
                    break;

                case 'mv':
                    await moveFile(client, currentPath, args, config.type);
                    break;

                case 'run':
                    await runCommand(client, args.join(' '), config.type);
                    break;

                case 'pwd':
                    console.log(chalk.cyan('Current path:', currentPath));
                    break;

                case 'help':
                    showHelp();
                    break;

                case 'exit':
                    spinner.succeed('Disconnected from server');
                    if (config.type === 'FTP') client.close();
                    else client.dispose();
                    return;

                case 'mkdir':
                    await makeDirectory(client, currentPath, args, config.type);
                    break;

                default:
                    console.log(chalk.red('Unknown command. Type "help" for available commands'));
            }
        }
    } catch (error) {
        spinner.fail('Connection failed');
        console.error(chalk.red('Error:'), error.message);
    }
}

async function listFiles(client, path, type) {
    try {
        let files;
        if (type === 'FTP') {
            files = await client.list(path);
        } else {
            const result = await client.execCommand('ls -la', { cwd: path });
            files = result.stdout.split('\n')
                .filter(line => line.trim() && !line.startsWith('total'))
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        type: line[0] === 'd' ? 'd' : '-',
                        permissions: parts[0],
                        size: parts[4],
                        date: `${parts[5]} ${parts[6]} ${parts[7]}`,
                        name: parts.slice(8).join(' ')
                    };
                });
        }

        console.log(chalk.cyan('\nDirectory listing:'));
        console.log(chalk.gray('─'.repeat(50)));

        // Sort directories first, then files
        files.sort((a, b) => {
            if (a.type === 'd' && b.type !== 'd') return -1;
            if (a.type !== 'd' && b.type === 'd') return 1;
            return a.name.localeCompare(b.name);
        });

        files.forEach(file => {
            const icon = file.type === 'd' ? '📁' : getFileIcon(file.name);
            const size = formatSize(file.size);
            const permissions = file.permissions || '';
            
            console.log(
                `${icon} ${chalk.white(file.name.padEnd(30))} ` +
                `${chalk.gray(size.padStart(10))} ` +
                `${chalk.gray(permissions)}`
            );
        });

        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.gray(`Total: ${files.length} items`));
    } catch (error) {
        console.error(chalk.red('Error listing files:'), error.message);
    }
}

async function changeDirectory(client, currentPath, newPath, type) {
    if (!newPath) {
        console.log(chalk.red('Please specify a directory'));
        return currentPath;
    }

    const path = newPath === '..' 
        ? currentPath.split('/').slice(0, -1).join('/') || '/'
        : `${currentPath}/${newPath}`.replace(/\/+/g, '/');

    try {
        if (type === 'FTP') {
            await client.cd(path);
        } else {
            await client.execCommand(`cd ${path} && pwd`);
        }
        console.log(chalk.cyan('Changed directory to:', path));
        return path;
    } catch (error) {
        console.error(chalk.red('Error changing directory:'), error.message);
        return currentPath;
    }
}

async function removeFile(client, currentPath, args, type) {
    if (!args.length) {
        console.log(chalk.red('Please specify file(s) or directory(ies) to remove'));
        return;
    }

    const isForceRemove = args[0] === '-f';
    const isRemoveAll = args[0] === '-all';
    
    if (isRemoveAll) {
        // Confirm before removing everything
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.red('⚠️ WARNING: This will remove ALL files and directories in the current path. Continue?'),
            default: false
        }]);

        if (!confirm) {
            console.log(chalk.yellow('Operation cancelled'));
            return;
        }

        const spinner = ora('Removing all files and directories...').start();

        try {
            if (type === 'FTP') {
                const files = await client.list(currentPath);
                for (const file of files) {
                    const fullPath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
                    if (file.type === 'd') {
                        await client.removeDir(fullPath);
                    } else {
                        await client.remove(fullPath);
                    }
                }
            } else {
                await client.execCommand(`rm -rf "${currentPath}"/*`);
            }
            spinner.succeed('Removed all files and directories');
        } catch (error) {
            spinner.fail('Failed to remove all files');
            console.error(chalk.red('Error:'), error.message);
        }
        return;
    }

    // Handle multiple files/directories
    let targets = [];
    if (isForceRemove) {
        // If -f flag is present, all arguments after it are directories to remove
        targets = args.slice(1);
        if (targets.length === 0) {
            console.log(chalk.red('Please specify directory(ies) to remove'));
            return;
        }
    } else {
        // All arguments are files to remove
        targets = args;
    }

    // Confirm before removing multiple items
    if (targets.length > 1) {
        console.log(chalk.yellow('\nFiles/directories to remove:'));
        targets.forEach(target => {
            console.log(chalk.yellow(`  • ${target}`));
        });
        
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow(`Are you sure you want to remove these ${targets.length} items?`),
            default: false
        }]);

        if (!confirm) {
            console.log(chalk.yellow('Operation cancelled'));
            return;
        }
    }

    const spinner = ora('Removing items...').start();
    const results = {
        success: [],
        failed: []
    };

    for (const target of targets) {
        const fullPath = `${currentPath}/${target}`.replace(/\/+/g, '/');
        
        try {
            if (type === 'FTP') {
                if (isForceRemove) {
                    await client.removeDir(fullPath);
                } else {
                    await client.remove(fullPath);
                }
            } else {
                const command = isForceRemove ? 
                    `rm -rf "${fullPath}"` : 
                    `rm "${fullPath}"`;
                await client.execCommand(command);
            }
            results.success.push(target);
        } catch (error) {
            results.failed.push({ target, error: error.message });
        }
    }

    // Show results
    if (results.success.length > 0) {
        spinner.succeed(`Successfully removed ${results.success.length} item(s)`);
        results.success.forEach(item => {
            console.log(chalk.green(`  ✔ ${item}`));
        });
    }

    if (results.failed.length > 0) {
        console.log(chalk.red(`\nFailed to remove ${results.failed.length} item(s):`));
        results.failed.forEach(({ target, error }) => {
            console.log(chalk.red(`  ✖ ${target}: ${error}`));
        });
    }
}

async function copyFile(client, currentPath, args, type) {
    if (args.length < 2) {
        console.log(chalk.red('Please specify source and destination'));
        return;
    }

    const [src, dest] = args;
    const srcPath = `${currentPath}/${src}`.replace(/\/+/g, '/');
    const destPath = `${currentPath}/${dest}`.replace(/\/+/g, '/');

    const spinner = ora('Copying...').start();

    try {
        if (type === 'FTP') {
            await client.downloadTo("temp_file", srcPath);
            await client.uploadFrom("temp_file", destPath);
            await fs.remove("temp_file");
        } else {
            await client.execCommand(`cp "${srcPath}" "${destPath}"`);
        }
        spinner.succeed(`Copied ${src} to ${dest}`);
    } catch (error) {
        spinner.fail(`Failed to copy ${src}`);
        console.error(chalk.red('Error:'), error.message);
    }
}

async function moveFile(client, currentPath, args, type) {
    if (args.length < 2) {
        console.log(chalk.red('Please specify source and destination'));
        return;
    }

    const [src, dest] = args;
    const srcPath = `${currentPath}/${src}`.replace(/\/+/g, '/');
    const destPath = `${currentPath}/${dest}`.replace(/\/+/g, '/');

    const spinner = ora('Moving...').start();

    try {
        if (type === 'FTP') {
            await client.rename(srcPath, destPath);
        } else {
            await client.execCommand(`mv "${srcPath}" "${destPath}"`);
        }
        spinner.succeed(`Moved ${src} to ${dest}`);
    } catch (error) {
        spinner.fail(`Failed to move ${src}`);
        console.error(chalk.red('Error:'), error.message);
    }
}

async function runCommand(client, command, type) {
    if (!command) {
        console.log(chalk.red('Please specify a command to run'));
        return;
    }

    const spinner = ora('Executing command...').start();

    try {
        if (type === 'FTP') {
            spinner.fail('Command execution not supported in FTP mode');
            return;
        }

        const result = await client.execCommand(command);
        spinner.succeed('Command executed');
        
        if (result.stdout) {
            console.log(chalk.green('\nOutput:'));
            console.log(result.stdout);
        }
        
        if (result.stderr) {
            console.log(chalk.yellow('\nErrors/Warnings:'));
            console.log(result.stderr);
        }
    } catch (error) {
        spinner.fail('Command execution failed');
        console.error(chalk.red('Error:'), error.message);
    }
}

async function makeDirectory(client, currentPath, args, type) {
    if (!args.length) {
        console.log(chalk.red('Please specify directory name(s) to create'));
        return;
    }

    const spinner = ora('Creating directories...').start();
    const results = {
        success: [],
        failed: []
    };

    for (const dir of args) {
        const fullPath = `${currentPath}/${dir}`.replace(/\/+/g, '/');
        
        try {
            if (type === 'FTP') {
                await client.ensureDir(fullPath);
            } else {
                await client.execCommand(`mkdir -p "${fullPath}"`);
            }
            results.success.push(dir);
        } catch (error) {
            results.failed.push({ dir, error: error.message });
        }
    }

    // Show results
    if (results.success.length > 0) {
        spinner.succeed(`Successfully created ${results.success.length} director${results.success.length === 1 ? 'y' : 'ies'}`);
        results.success.forEach(dir => {
            console.log(chalk.green(`  ✔ ${dir}`));
        });
    }

    if (results.failed.length > 0) {
        console.log(chalk.red(`\nFailed to create ${results.failed.length} director${results.failed.length === 1 ? 'y' : 'ies'}:`));
        results.failed.forEach(({ dir, error }) => {
            console.log(chalk.red(`  ✖ ${dir}: ${error}`));
        });
    }
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        js: '📜',
        json: '📋',
        md: '📝',
        txt: '📄',
        jpg: '🖼️',
        jpeg: '🖼️',
        png: '🖼️',
        gif: '🖼️',
        pdf: '📕',
        zip: '📦',
        rar: '📦',
        tar: '📦',
        gz: '📦',
        mp3: '🎵',
        mp4: '🎥',
        default: '📄'
    };
    return icons[ext] || icons.default;
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function showHelp() {
    console.log(chalk.cyan('\nAvailable commands:'));
    console.log(chalk.white(`
    ls                          - List files and directories
    cd <dir>                    - Change directory
    pwd                         - Show current directory
    mkdir <dir1> [dir2...]     - Create one or more directories
    rmv <file1> [file2...]     - Remove one or more files
    rmv -f <dir1> [dir2...]    - Remove one or more directories
    rmv -all                    - Remove all files and directories in current path
    cp <src> <dest>            - Copy file
    mv <src> <dest>            - Move file
    run <command>              - Run terminal command
    help                       - Show this help
    exit                       - Exit browse mode
    
    Examples:
    mkdir images               - Create single directory
    mkdir css js images        - Create multiple directories
    rmv file1.txt file2.txt    - Remove multiple files
    rmv -f folder1 folder2     - Remove multiple directories
    `));
} 
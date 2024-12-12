#!/usr/bin/env node

import { program } from 'commander';
import inquirer from 'inquirer';
import { NodeSSH } from 'node-ssh';
import * as ftp from 'basic-ftp';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import { saveConfig, loadConfig } from './config.js';
import { showBanner } from './banner.js';
import boxen from 'boxen';
import { FileTracker } from './fileTracker.js';
import {glob} from 'glob';
import { IgnoreHandler } from './ignoreHandler.js';
import { CommandRunner } from './commandRunner.js';
import { browse } from './commands/browse.js';
import { homedir } from 'os';
import gradient from 'gradient-string';

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Create a separate function for the getting started guide
function showGettingStarted() {
  showBanner();
  console.log(gradient.pastel.multiline(
    boxen(
      '🚀 Getting Started with CSDeploy\n\n' +
      '1. Initialize a New Project\n' +
      '   $ csdeploy init\n' +
      '   Creates configuration files and project structure\n\n' +
      '2. Configure Your Deployment\n' +
      '   $ csdeploy config\n' +
      '   Set up your deployment preferences\n\n' +
      '3. Deploy Your Project\n' +
      '   $ csdeploy deploy\n' +
      '   Choose deployment type:\n' +
      '   • Files only\n' +
      '   • Run commands only\n' +
      '   • Both files and commands\n\n' +
      '4. Additional Features\n' +
      '   $ csdeploy browse    Interactive file browser\n' +
      '   $ csdeploy status    Check deployment status\n' +
      '   $ csdeploy edit      Modify configuration',
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: '📚 Quick Guide',
        titleAlignment: 'center'
      }
    )
  ));
}

// Update the program configuration
program
  .name('csdeploy')
  .description('Modern web deployment CLI for cPanel/Hostinger')
  .version('1.3.0')
  .action(() => {
    // Show getting started guide for root command
    showGettingStarted();
  });

// Add help option explicitly
program
  .option('-h, --help', 'Display help information')
  .on('option:help', () => {
    showGettingStarted();
  });

// Handle unknown commands
program
  .on('command:*', () => {
    console.error(chalk.red('\nError: Invalid command'));
    showGettingStarted();
    process.exit(1);
  });

// Show getting started if no arguments provided
if (!process.argv.slice(2).length) {
  showGettingStarted();
}

async function deployViaFTP(config, spinner, deploymentType = 'both') {
  const client = new ftp.Client();
  const fileTracker = new FileTracker(path.resolve(config.localPath));
  const ignoreHandler = new IgnoreHandler(path.resolve(config.localPath));
  const commandRunner = new CommandRunner(path.resolve(config.localPath), config.remotePath);
  let commandResult = null;

  try {
    // Handle file deployment if requested
    if (deploymentType === 'files' || deploymentType === 'both') {
      await ignoreHandler.loadIgnoreFile();
      spinner.start('Checking for modified files...');
      const { changedFiles, newHashes } = await fileTracker.findChangedFiles();

      // Filter out ignored files
      const filesToUpload = changedFiles.filter(file => !ignoreHandler.isIgnored(file));
      const ignoredFiles = changedFiles.filter(file => ignoreHandler.isIgnored(file));

      if (filesToUpload.length === 0) {
        spinner.succeed('No files to deploy (all changed files are ignored or no changes)');
      } else {
        // Connect and deploy files
        spinner.start('Connecting to FTP server...');
        await client.access({
          host: config.host,
          user: config.username,
          password: config.password,
          secure: config.secure
        });

        // Upload non-ignored files
        for (const file of filesToUpload) {
          spinner.start(`Uploading ${file}...`);
          const localPath = path.join(config.localPath, file);
          const remotePath = path.join(config.remotePath, file);
          
          // Ensure remote directory exists
          await client.ensureDir(path.dirname(remotePath));
          await client.uploadFrom(localPath, remotePath);
        }

        // Only update hashes for non-ignored files
        const updatedHashes = {};
        for (const [file, hash] of Object.entries(newHashes)) {
          if (!ignoreHandler.isIgnored(file)) {
            updatedHashes[file] = hash;
          }
        }
        await fileTracker.updateTrackedFiles(updatedHashes);

        spinner.succeed(`Successfully deployed ${filesToUpload.length} files`);
        
        // Show deployment summary
        console.log(
          boxen(
            chalk.cyan('Deployed Files:\n') +
            filesToUpload.map(file => chalk.green(`✔ ${file}`)).join('\n') +
            (ignoredFiles.length > 0 ? 
              '\n\n' + chalk.yellow('Ignored Files:\n') +
              ignoredFiles.map(file => chalk.gray(`• ${file}`)).join('\n') : ''),
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'green',
              title: 'Deployment Summary',
              titleAlignment: 'center'
            }
          )
        );
      }
    }

    // Handle command execution if requested
    if (deploymentType === 'commands' || deploymentType === 'both') {
      spinner.start('Executing post-deployment commands...');
      commandResult = await commandRunner.executeCommands(client, false);
      if (!commandResult.success) {
        console.log(chalk.yellow('Note: Command execution over FTP is limited. Consider using SSH for full command execution support.'));
      }
    }

    // Final summary
    if (deploymentType === 'commands' || deploymentType === 'both') {
      console.log(
        boxen(
          chalk.green('Deployment completed successfully!') + '\n\n' +
          chalk.cyan('Summary:') + '\n' +
          (deploymentType === 'files' || deploymentType === 'both' ? chalk.white(`• Files deployed: ${filesToUpload?.length || 0}`) + '\n' : '') +
          (deploymentType === 'commands' || deploymentType === 'both' ? chalk.white(`• Commands executed: ${commandResult?.results?.length || 0}`) : ''),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            title: 'Deployment Complete',
            titleAlignment: 'center'
          }
        )
      );
    }

  } catch (error) {
    throw error;
  } finally {
    client.close();
  }
}

async function deployViaSSH(config, spinner) {
  const ssh = new NodeSSH();
  const fileTracker = new FileTracker(path.resolve(config.localPath));

  try {
    spinner.start('Analyzing files for deployment...');
    
    // Get files that should be deployed
    const { deployableFiles, ignoredFiles, newHashes } = await fileTracker.getDeployableFiles();

    // Log ignored files
    if (ignoredFiles.length > 0) {
      console.log(
        boxen(
          chalk.yellow('Ignored Files (will not be deployed):\n') +
          ignoredFiles.map(f => chalk.gray(`• ${f}`)).join('\n'),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
            title: 'Skipped Files',
            titleAlignment: 'center'
          }
        )
      );
    }

    if (deployableFiles.length === 0) {
      spinner.succeed('No files to deploy (all files are either ignored or unchanged)');
      return;
    }

    // Connect to SSH
    spinner.start('Connecting to SSH server...');
    const sshConfig = {
      host: config.host,
      username: config.username,
      privateKey: config.privateKey ? fs.readFileSync(config.privateKey, 'utf8') : undefined,
      passphrase: config.passphrase
    };

    await ssh.connect(sshConfig);
    spinner.succeed('Connected to SSH server');

    // Deploy each file
    for (const file of deployableFiles) {
      spinner.start(`Deploying ${file}...`);
      
      // Double-check ignore status before deploying each file
      const shouldIgnore = await fileTracker.shouldIgnoreFile(file);
      if (shouldIgnore) {
        spinner.info(`Skipping ignored file: ${file}`);
        continue;
      }

      const localPath = path.join(config.localPath, file);
      const remotePath = path.join(config.remotePath, file);
      
      // Ensure remote directory exists
      const remoteDir = path.dirname(remotePath);
      await ssh.execCommand(`mkdir -p "${remoteDir}"`);
      
      // Upload file
      await ssh.putFile(localPath, remotePath);
      spinner.succeed(`Deployed ${file}`);
    }

    // Update tracking only for deployed files
    const deployedHashes = {};
    for (const file of deployableFiles) {
      if (newHashes[file]) {
        deployedHashes[file] = newHashes[file];
      }
    }
    await fileTracker.updateTrackedFiles(deployedHashes);

    // Final summary
    console.log(
      boxen(
        chalk.cyan('Successfully Deployed:\n') +
        deployableFiles.map(f => chalk.green(`✔ ${f}`)).join('\n'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green',
          title: 'Deployment Summary',
          titleAlignment: 'center'
        }
      )
    );

  } catch (error) {
    spinner.fail(`Deployment failed: ${error.message}`);
    throw error;
  } finally {
    ssh.dispose();
  }
}

async function verifyDeployment(config) {
  // Add verification logic here
  // e.g., check if index.php/html exists
  // check file permissions
  // test website response
}

async function promptForDeployment() {
  try {
    showBanner();
    
    // Load existing config
    let config = await loadConfig();

    if (!config) {
      console.log(chalk.yellow('No configuration found. Please run deploy first.'));
      return;
    }

    // Ask for deployment type
    const { deploymentType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'deploymentType',
        message: 'What would you like to deploy?',
        choices: [
          { name: 'Files only', value: 'files' },
          { name: 'Run commands only', value: 'commands' },
          { name: 'Both files and commands', value: 'both' }
        ]
      }
    ]);

    const spinner = ora('Starting deployment...').start();

    try {
      // Handle SSH connection
      if (config.type !== 'FTP') {
        const ssh = new NodeSSH();
        
        // Resolve and read private key
        if (config.privateKey) {
          const privateKeyPath = config.privateKey
            .replace(/^~/, homedir())
            .replace(/\\/g, '/');
          
          try {
            config.privateKey = await fs.readFile(privateKeyPath, 'utf8');
          } catch (error) {
            spinner.fail('Failed to read private key');
            console.error(chalk.red('Error:'), error.message);
            return;
          }
        }

        // Connect to SSH
        try {
          spinner.text = 'Connecting to SSH...';
          await ssh.connect({
            host: config.host,
            username: config.username,
            privateKey: config.privateKey,
            passphrase: config.passphrase
          });
          spinner.succeed('Connected to SSH');

          // Initialize command runner
          const commandRunner = new CommandRunner(
            path.resolve(config.localPath), 
            config.remotePath
          );

          // Execute based on deployment type
          if (deploymentType === 'commands' || deploymentType === 'both') {
            spinner.start('Executing commands...');
            const result = await commandRunner.executeCommands(ssh, true);
            
            if (result.success) {
              spinner.succeed('Commands executed successfully');
              result.results.forEach(cmd => {
                if (cmd.output) {
                  console.log(chalk.cyan('\nCommand output:'));
                  console.log(cmd.output);
                }
              });
            } else {
              spinner.fail('Command execution failed');
              console.error(chalk.red('Error:'), result.results[0].output);
            }
          }

          // Handle file deployment separately
          if (deploymentType === 'files' || deploymentType === 'both') {
            await deployViaSSH(config, spinner);
          }

        } finally {
          ssh.dispose();
        }
      } else {
        // Handle FTP deployment
        if (deploymentType === 'commands') {
          spinner.warn('Command execution is not supported over FTP. Please use SSH for command execution.');
          return;
        }
        await deployViaFTP(config, spinner, deploymentType);
      }

    } catch (error) {
      spinner.fail('Deployment failed');
      console.error(chalk.red('Error:'), error.message);
    }

  } catch (error) {
    console.error(chalk.red('Error deploying:'), error.message);
    process.exit(1);
  }
}

program
  .command('deploy')
  .description('Deploy your web project')
  .action(async () => {
    try {
      await promptForDeployment();
    } catch (error) {
      console.error(chalk.red('Deployment failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage saved configurations')
  .option('-c, --clear', 'Clear saved configuration')
  .option('-s, --show', 'Show current configuration')
  .action(async (options) => {
    showBanner();
    
    const fileTracker = new FileTracker(process.cwd());
    
    try {
      if (options.clear) {
        const spinner = ora({
          text: 'Clearing configuration...',
          color: 'cyan'
        }).start();
        
        await fs.remove(fileTracker.deployFolder);
        spinner.succeed('Configuration cleared successfully!');
      } else if (options.show) {
        const config = await fileTracker.loadConfig();
        if (config) {
          console.log(
            boxen(
              chalk.cyan('Current Configuration:\n\n') +
              chalk.white(JSON.stringify(config, null, 2)) + '\n\n' +
              chalk.cyan('Project Directory:\n') +
              chalk.white(fileTracker.deployFolder),
              {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan',
                title: 'CSCC Auto-Deploy Config',
                titleAlignment: 'center'
              }
            )
          );
        } else {
          console.log(
            boxen(
              chalk.yellow('No saved configuration found in this project.'),
              {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'yellow'
              }
            )
          );
        }
      }
    } catch (error) {
      console.error(chalk.red('Error managing configuration:'), error.message);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show CSCC Auto-Deploy version')
  .action(() => {
    showBanner();
  });

program
  .command('edit')
  .description('Edit specific configuration fields')
  .action(async () => {
    try {
      showBanner();
      
      const config = await loadConfig();
      if (!config) {
        console.log(chalk.yellow('No configuration found. Please run deploy first to create one.'));
        return;
      }

      const fieldChoices = [
        { name: 'Host/Domain', value: 'host' },
        { name: 'Username', value: 'username' },
        { name: 'Private Key Path', value: 'privateKey' },
        { name: 'Remote Path', value: 'remotePath' },
        { name: 'Local Path', value: 'localPath' },
        { name: 'Connection Type', value: 'type' },
        { name: 'SSH Key Passphrase', value: 'passphrase' }
      ];

      const { field } = await inquirer.prompt([
        {
          type: 'list',
          name: 'field',
          message: 'Which field would you like to edit?',
          choices: fieldChoices
        }
      ]);

      let newValue;
      if (field === 'type') {
        const response = await inquirer.prompt([
          {
            type: 'list',
            name: 'value',
            message: 'Select connection type:',
            choices: ['FTP', 'SFTP/SSH'],
            default: config.type
          }
        ]);
        newValue = response.value;
      } else if (field === 'passphrase') {
        const response = await inquirer.prompt([
          {
            type: 'password',
            name: 'value',
            message: 'Enter new SSH key passphrase:',
            mask: '*'
          }
        ]);
        newValue = response.value;
      } else {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: `Enter new ${field}:`,
            default: config[field]
          }
        ]);
        newValue = response.value;
      }

      // Update the configuration
      const updatedConfig = {
        ...config,
        [field]: newValue
      };

      // Save the updated configuration
      await saveConfig(updatedConfig);

      console.log(
        boxen(
          chalk.green('✔ Configuration updated successfully!\n\n') +
          chalk.cyan(`${field}: `) + chalk.white(newValue),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green'
          }
        )
      );

    } catch (error) {
      console.error(chalk.red('Error updating configuration:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize CSCC Auto-Deploy in the project')
  .action(async () => {
    try {
      showBanner();
      
      const fileTracker = new FileTracker(process.cwd());
      const ignoreHandler = new IgnoreHandler(process.cwd());
      
      const spinner = ora('Initializing CSCC Auto-Deploy...').start();
      
      // Create .cscc-ignore file
      const ignoreCreated = await ignoreHandler.createDefaultIgnoreFile();
      
      if (ignoreCreated) {
        spinner.succeed('Created .cscc-ignore file');
      } else {
        spinner.info('.cscc-ignore file already exists');
      }

      // Create .deploycommands template
      const commandsCreated = await CommandRunner.createTemplate(process.cwd());
      if (commandsCreated) {
        console.log(chalk.green('✓ Created .deploycommands template file'));
      }

      // Ensure deploy folder exists
      await fs.ensureDir(fileTracker.deployFolder);
      spinner.succeed('Initialized CSCC Auto-Deploy successfully!');

      console.log(
        boxen(
          chalk.cyan('Created:') + '\n' +
          chalk.white('- .cscc-ignore (Deployment ignore patterns)') + '\n' +
          chalk.white('- .cscc-deploy/ (Deployment tracking)') + '\n' +
          chalk.white('- .deploycommands (Post-deployment commands)') + '\n\n' +
          chalk.cyan('Next steps:') + '\n' +
          chalk.white('1. Edit .cscc-ignore to customize ignored files') + '\n' +
          chalk.white('2. Run "csdeploy deploy" to start deployment'),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            title: 'CSCC Auto-Deploy Initialized',
            titleAlignment: 'center'
          }
        )
      );

    } catch (error) {
      console.error(chalk.red('Error initializing CSCC Auto-Deploy:'), error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show tracking information and cached files')
  .action(async () => {
    try {
      showBanner();
      
      const fileTracker = new FileTracker(process.cwd());
      const config = await fileTracker.loadConfig();
      
      if (!config) {
        console.log(chalk.yellow('No configuration found. Please run deploy first.'));
        return;
      }

      const { changedFiles } = await fileTracker.findChangedFiles();
      const ignoreHandler = new IgnoreHandler(process.cwd());
      await ignoreHandler.loadIgnoreFile();

      console.log(
        boxen(
          chalk.cyan('Tracking Directory: ') + 
          chalk.white(fileTracker.deployFolder) + '\n\n' +
          chalk.cyan('Ignore File: ') +
          chalk.white(path.join(process.cwd(), '.cscc-ignore')) + '\n\n' +
          chalk.cyan('Modified Files: ') + 
          chalk.yellow(changedFiles.length) + '\n' +
          (changedFiles.length > 0 ? 
            '\n' + changedFiles.map(f => chalk.yellow(`• ${f}`)).join('\n') : 
            ''),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            title: 'CSCC Auto-Deploy Status',
            titleAlignment: 'center'
          }
        )
      );

    } catch (error) {
      console.error(chalk.red('Error showing status:'), error.message);
      process.exit(1);
    }
  });

program
  .command('check-ignore')
  .description('Check ignore patterns and manage .cscc-ignore file')
  .option('-l, --list', 'List all ignored files')
  .option('-c, --create', 'Create .cscc-ignore if it doesn\'t exist')
  .option('-t, --test <file>', 'Test if a specific file is ignored')
  .action(async (options) => {
    try {
      showBanner();
      
      const ignoreHandler = new IgnoreHandler(process.cwd());
      const spinner = ora('Checking ignore patterns...').start();

      // Check if .cscc-ignore exists
      const ignoreExists = await fs.pathExists(ignoreHandler.ignoreFile);

      if (!ignoreExists) {
        spinner.warn('.cscc-ignore file not found');
        
        if (options.create) {
          spinner.start('Creating .cscc-ignore file...');
          await ignoreHandler.createDefaultIgnoreFile();
          spinner.succeed('Created .cscc-ignore file with default patterns');
        } else {
          console.log(
            boxen(
              chalk.yellow('No .cscc-ignore file found!\n\n') +
              chalk.white('Run one of the following commands:\n') +
              chalk.cyan('csdeploy check-ignore --create') + 
              chalk.white(' - Create with default patterns\n') +
              chalk.cyan('csdeploy init') + 
              chalk.white(' - Initialize full project'),
              {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'yellow',
                title: 'Missing .cscc-ignore',
                titleAlignment: 'center'
              }
            )
          );
          return;
        }
      }

      // Load ignore patterns
      await ignoreHandler.loadIgnoreFile();
      
      if (options.test) {
        spinner.text = 'Testing file...';
        try {
          // Normalize the test path
          const testPath = path.resolve(process.cwd(), options.test);
          const isIgnored = ignoreHandler.isIgnored(testPath);
          
          spinner.stop();
          console.log(
            boxen(
              chalk.cyan('File: ') + chalk.white(options.test) + '\n' +
              chalk.cyan('Relative Path: ') + 
              chalk.white(path.relative(process.cwd(), testPath)) + '\n' +
              chalk.cyan('Status: ') + 
              (isIgnored ? 
                chalk.yellow('IGNORED') : 
                chalk.green('NOT IGNORED')),
              {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: isIgnored ? 'yellow' : 'green',
                title: 'Ignore Test Result',
                titleAlignment: 'center'
              }
            )
          );
        } catch (error) {
          spinner.fail(`Invalid file path: ${options.test}`);
          return;
        }
      } else if (options.list) {
        // List all ignored files
        spinner.text = 'Scanning project files...';
        
        const allFiles = glob.sync('**/*', {
          cwd: process.cwd(),
          dot: true,
          nodir: false
        });

        const ignoredFiles = allFiles.filter(file => ignoreHandler.isIgnored(file));
        
        spinner.stop();
        console.log(
          boxen(
            chalk.cyan('Ignored Patterns:\n') +
            chalk.white('Default patterns:') + '\n' +
            ignoreHandler.defaultPatterns.map(p => 
              chalk.yellow(`  • ${p}`)
            ).join('\n') + '\n\n' +
            chalk.white('Custom patterns:') + '\n' +
            (await fs.readFile(ignoreHandler.ignoreFile, 'utf8'))
              .split('\n')
              .filter(line => line.trim() && !line.startsWith('#'))
              .map(p => chalk.yellow(`  • ${p}`))
              .join('\n') + '\n\n' +
            chalk.cyan('Ignored Files ') + 
            chalk.white(`(${ignoredFiles.length} total):\n`) +
            ignoredFiles.map(f => chalk.yellow(`  • ${f}`)).join('\n'),
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'cyan',
              title: 'Ignore Patterns',
              titleAlignment: 'center'
            }
          )
        );
      } else {
        // Just check if file exists and is valid
        spinner.succeed('.cscc-ignore file exists and is valid');
        
        console.log(
          boxen(
            chalk.cyan('Available Commands:\n\n') +
            chalk.white('List all ignored files:\n') +
            chalk.cyan('  csdeploy check-ignore --list\n\n') +
            chalk.white('Test specific file:\n') +
            chalk.cyan('  csdeploy check-ignore --test <file>\n\n') +
            chalk.white('Create ignore file:\n') +
            chalk.cyan('  csdeploy check-ignore --create'),
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'cyan',
              title: 'Ignore Pattern Help',
              titleAlignment: 'center'
            }
          )
        );
      }

    } catch (error) {
      console.error(chalk.red('Error checking ignore patterns:'), error.message);
      process.exit(1);
    }
  });

program
  .command('browse')
  .description('Browse and manage remote files interactively')
  .action(async () => {
    try {
      showBanner();
      const config = await loadConfig();
      
      if (!config) {
        console.log(chalk.yellow('No configuration found. Please run deploy first.'));
        return;
      }

      // Resolve the private key path properly
      if (config.privateKey) {
        config.privateKey = config.privateKey
          .replace(/^~/, homedir())
          .replace(/\\/g, '/');
        
        try {
          // Read the private key file
          config.privateKey = fs.readFileSync(config.privateKey, 'utf8');
        } catch (error) {
          console.error(chalk.red('Error reading private key:'), error.message);
          return;
        }
      }

      await browse();
    } catch (error) {
      console.error(chalk.red('Error in browse mode:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv); 
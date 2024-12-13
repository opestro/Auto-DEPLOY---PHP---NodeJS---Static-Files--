import chalk from 'chalk';
import { format } from 'date-fns';

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.lastLogId = 0;
    this.lastLogTime = 0;
    this.lastLogMessage = '';
  }

  // Format timestamp for logs
  formatTime() {
    return format(new Date(), 'HH:mm:ss');
  }

  // Add log with type and store it
  addLog(message, type = 'info', command = false, output = null) {
    const now = Date.now();
    
    // Prevent duplicate logs within 1 second
    if (message === this.lastLogMessage && now - this.lastLogTime < 1000) {
      return null;
    }

    const log = {
      id: ++this.lastLogId,
      timestamp: this.formatTime(),
      message,
      type,
      command,
      output
    };

    this.lastLogTime = now;
    this.lastLogMessage = message;
    
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    return log;
  }

  // Get all stored logs
  getLogs() {
    return this.logs;
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
  }

  // Log methods with console output
  info(message) {
    console.log(chalk.blue(`[${this.formatTime()}] ℹ️ ${message}`));
    return this.addLog(message, 'info');
  }

  success(message) {
    console.log(chalk.green(`[${this.formatTime()}] ✅ ${message}`));
    return this.addLog(message, 'success');
  }

  warning(message) {
    console.log(chalk.yellow(`[${this.formatTime()}] ⚠️ ${message}`));
    return this.addLog(message, 'warning');
  }

  error(message, error = null) {
    console.error(chalk.red(`[${this.formatTime()}] ❌ ${message}`));
    if (error) console.error(chalk.red(error.stack));
    return this.addLog(message, 'error');
  }

  // Deployment specific logs
  deploymentStart(type) {
    return this.info(`Starting ${type} deployment...`);
  }

  deploymentProgress(file, status) {
    return this.info(`Deploying ${file}: ${status}`);
  }

  deploymentSuccess(type) {
    return this.success(`${type} deployment completed successfully`);
  }

  deploymentError(type, error) {
    return this.error(`${type} deployment failed: ${error.message}`, error);
  }
}

export const logger = new Logger(); 
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let serverProcess = null;
let clientProcess = null;

async function startDashboard() {
  try {
    // Start server
    serverProcess = spawn('node', ['dashboard/server/src/index.js'], {
      stdio: 'inherit',
      shell: true, // Important for Windows
      windowsHide: true
    });

    // Start client
    const clientPath = path.join(__dirname, '../dashboard/client');
    clientProcess = spawn('npm', ['run', 'dev'], {
      cwd: clientPath,
      stdio: 'inherit',
      shell: true, // Important for Windows
      windowsHide: true
    });

    // Handle process cleanup
    const cleanup = async () => {
      try {
        if (process.platform === 'win32') {
          // Windows-specific process termination
          if (serverProcess) {
            spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
          }
          if (clientProcess) {
            spawn('taskkill', ['/pid', clientProcess.pid, '/f', '/t']);
          }
        } else {
          // Unix-like systems
          if (serverProcess) serverProcess.kill();
          if (clientProcess) clientProcess.kill();
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      process.exit();
    };

    // Handle process termination
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);

    // Handle process errors
    serverProcess.on('error', (error) => {
      console.error('Server process error:', error);
    });

    clientProcess.on('error', (error) => {
      console.error('Client process error:', error);
    });

  } catch (error) {
    console.error('Failed to start dashboard:', error);
    process.exit(1);
  }
}

export { startDashboard }; 
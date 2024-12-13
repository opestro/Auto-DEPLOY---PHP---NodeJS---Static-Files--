import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let serverProcess = null;
let clientProcess = null;

const SERVER_PORT = 3001;

async function startDashboard() {
  try {
    // Start server
    serverProcess = spawn('node', ['dashboard/server/src/index.js'], {
      stdio: 'inherit',
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        PORT: SERVER_PORT.toString()
      }
    });

    // Start client server using the absolute path
    const dashboardClientPath = path.join(__dirname, 'dashboardClient.js');
    
    // Log the path for debugging
    console.log('Starting dashboard client from:', dashboardClientPath);
    
    clientProcess = spawn('node', [dashboardClientPath], {
      stdio: 'inherit',
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_OPTIONS: '--experimental-json-modules'  // Add this if needed for ES modules
      }
    });

    // Handle process cleanup
    const cleanup = async () => {
      try {
        if (process.platform === 'win32') {
          if (serverProcess) {
            spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
          }
          if (clientProcess) {
            spawn('taskkill', ['/pid', clientProcess.pid, '/f', '/t']);
          }
        } else {
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
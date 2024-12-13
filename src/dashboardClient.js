import { createServer } from 'http';
import serveStatic from 'serve-static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLIENT_PORT = 3000;
const clientOutputPath = join(__dirname, '../dashboard/client/.output/public');

async function startServer() {
  try {
    // Create HTTP server
    const server = createServer((req, res) => {
      // Serve static files from the Nuxt output directory
      const serve = serveStatic(clientOutputPath);
      
      serve(req, res, (err) => {
        if (err) {
          console.error('Error serving static files:', err);
          res.statusCode = 500;
          res.end('Internal server error');
          return;
        }

        // For any other route, serve the index.html
        const indexPath = join(clientOutputPath, 'index.html');
        
        try {
          if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath);
            res.setHeader('Content-Type', 'text/html');
            res.end(content);
          } else {
            // If index.html doesn't exist, serve the default Nuxt app
            res.setHeader('Content-Type', 'text/html');
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>CSDeploy Dashboard</title>
                  <link rel="stylesheet" href="/_nuxt/entry.css">
                </head>
                <body>
                  <div id="__nuxt"></div>
                  <script type="module" src="/_nuxt/entry.js"></script>
                </body>
              </html>
            `);
          }
        } catch (error) {
          console.error('Error reading index.html:', error);
          res.statusCode = 500;
          res.end('Internal server error');
        }
      });
    });

    server.listen(CLIENT_PORT, () => {
      console.log(chalk.cyan('\nDashboard available at:'));
      console.log(chalk.cyan(`  ➜ Client: http://localhost:${CLIENT_PORT}`));
    });

  } catch (error) {
    console.error(chalk.red('Failed to start dashboard client:'), error);
    process.exit(1);
  }
}

startServer(); 
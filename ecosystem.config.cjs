/**
 * PM2 process file for n8n on Cloudways Velocity.
 * nginx (SSR mode) terminates TLS and proxies to 127.0.0.1:3000.
 *
 * Usage (from this directory):
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
const path = require('path');

const appDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'n8n',
      cwd: appDir,
      script: path.join(appDir, 'node_modules/n8n/bin/n8n'),
      args: 'start',
      interpreter: process.env.N8N_NODE_BINARY || '/opt/node/24/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '900M',
      env_file: path.join(appDir, '.env'),
      error_file: path.join(appDir, '../logs/n8n-error.log'),
      out_file: path.join(appDir, '../logs/n8n-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};

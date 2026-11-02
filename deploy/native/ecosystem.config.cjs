// pm2 process for the portal API on a native (no Docker) server.
//   pm2 start deploy/native/ecosystem.config.cjs && pm2 save
// Settings come from server/.env (see deploy/native/README.md).
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

module.exports = {
  apps: [
    {
      name: 'online-learning-api',
      cwd: path.join(root, 'server'),
      script: 'dist/index.js',
      node_args: '--env-file=.env',
      instances: 1,
      max_memory_restart: '300M', // small server: restart rather than push the SMS into swap
      time: true,
      out_file: path.join(root, 'logs/api.log'),
      error_file: path.join(root, 'logs/api-error.log'),
    },
  ],
};

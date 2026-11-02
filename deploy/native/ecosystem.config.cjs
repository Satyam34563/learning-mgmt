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
      // absolute path: pm2 doesn't always resolve node args from cwd
      node_args: `--env-file=${path.join(root, 'server/.env')}`,
      exec_mode: 'fork', // one process; cluster mode isn't needed on a 1-CPU server
      max_memory_restart: '300M', // small server: restart rather than push the SMS into swap
      time: true,
      out_file: path.join(root, 'logs/api.log'),
      error_file: path.join(root, 'logs/api-error.log'),
    },
  ],
};

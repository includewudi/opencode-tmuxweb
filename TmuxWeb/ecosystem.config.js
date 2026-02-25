module.exports = {
  apps: [
    {
      name: 'tmuxweb-dev-backend',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'tmuxweb-dev-frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --port 5216 --host',
      cwd: __dirname + '/web',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}

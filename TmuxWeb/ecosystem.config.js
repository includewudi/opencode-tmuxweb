module.exports = {
  apps: [
    {
      name: 'tmuxweb-backend',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'tmuxweb-frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --port 5215 --host',
      cwd: __dirname + '/web',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}

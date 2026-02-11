const config = require('../TmuxWeb/server/config.json');

module.exports = {
    apps: [
        {
            name: 'iterm-api',
            script: 'server.js',
            cwd: __dirname,
            watch: ['server.js', 'speech.js', 'pty_helper.py'],
            env: { PORT: config.port || 8215 },
        },
        {
            name: 'iterm-app',
            script: 'npx',
            args: 'vite --host',
            cwd: __dirname + '/app',
        }
    ],
};


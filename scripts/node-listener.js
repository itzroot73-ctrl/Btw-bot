const express = require('express');
const path = require('path');
const pm2 = require('pm2');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.LISTENER_PORT || 4000;
const AUTH_KEY = process.env.NODE_AUTH_KEY;

const secureNode = (req, res, next) => {
    if (req.headers['x-nexus-key'] !== AUTH_KEY) return res.status(403).json({ error: 'Unauthorized' });
    next();
};

pm2.connect(() => console.log('PM2 Connected'));

app.post('/deploy', secureNode, (req, res) => {
    const { username, host, port, instanceId } = req.body;
    pm2.start({
        name: `nexus-${instanceId}`,
        script: path.join(__dirname, '..', 'bot.js'),
        args: [JSON.stringify({ username, host, port, instanceId })],
        autorestart: true,
        env: { CORE_URL: process.env.CORE_URL }
    }, (err, apps) => res.json({ status: 'deployed' }));
});

app.post('/update-settings', secureNode, (req, res) => {
    const { instanceId, settings } = req.body;
    pm2.sendDataToProcessId({
        id: `nexus-${instanceId}`,
        type: 'process:msg',
        data: { type: 'update-settings', settings },
        topic: 'update-settings'
    }, () => res.json({ status: 'queued' }));
});

app.post('/send-chat', secureNode, (req, res) => {
    const { instanceId, message } = req.body;
    pm2.sendDataToProcessId({
        id: `nexus-${instanceId}`,
        type: 'process:msg',
        data: { type: 'send-chat', message },
        topic: 'send-chat'
    }, () => res.json({ status: 'sent' }));
});

app.listen(PORT, () => console.log(`VPS Listener active on port ${PORT}`));

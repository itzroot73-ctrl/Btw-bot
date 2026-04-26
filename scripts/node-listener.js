/**
 * NEXUS VPS LISTENER
 * Deploy this on every remote VPS node.
 */
const express = require('express');
const { fork } = require('child_process');
const path = require('path');
const pm2 = require('pm2');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.LISTENER_PORT || 4000;
const AUTH_KEY = process.env.NODE_AUTH_KEY;

// Security Middleware for Core API -> Node Listener communication
const secureNode = (req, res, next) => {
    if (req.headers['x-nexus-key'] !== AUTH_KEY) {
        return res.status(403).json({ error: 'Unauthorized Node Access' });
    }
    next();
};

pm2.connect((err) => {
    if (err) {
        console.error('PM2 Connection Error:', err);
        process.exit(2);
    }
    console.log('Connected to PM2');
});

app.post('/deploy', secureNode, (req, res) => {
    const { username, host, port, instanceId } = req.body;

    pm2.start({
        name: `nexus-${instanceId}`,
        script: path.join(__dirname, '..', 'bot.js'), // Corrected path to root
        args: [JSON.stringify({ username, host, port, instanceId })],
        autorestart: true,
        max_restarts: 10,
        env: {
            CORE_URL: process.env.CORE_URL // Remote core to report back to
        }
    }, (err, apps) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'deployed', pm2Id: apps[0].pm2_id });
    });
});

app.post('/stop', secureNode, (req, res) => {
    const { instanceId } = req.body;
    pm2.delete(`nexus-${instanceId}`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'terminated' });
    });
});

app.get('/health', (req, res) => {
    pm2.list((err, list) => {
        res.json({
            status: 'online',
            load: list ? list.length : 0
        });
    });
});

app.listen(PORT, () => console.log(`VPS Listener active on port ${PORT}`));

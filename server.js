const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
const { spawn } = require('child_process');
const ping = require('ping');
require('dotenv').config();

// Models & Middleware
const Node = require('./models/Node');
const Instance = require('./models/Instance');
const auth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus_secret_gateway';

// --- DATABASE CONNECTION ---
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to Nexus Database'))
        .catch(err => console.error('Database connection error:', err));
} else {
    console.warn('MONGODB_URI not found. Data will not persist.');
}

// --- API ENDPOINTS ---

// Instance Management
app.get('/api/instances', async (req, res) => {
    try {
        const instances = await Instance.find();
        res.json(instances);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/instances', async (req, res) => {
    try {
        const instance = new Instance(req.body);
        await instance.save();

        // Spawn the bot
        await deployInstance(instance);

        res.status(201).json(instance);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/instances/:id/restart', async (req, res) => {
    try {
        const instance = await Instance.findById(req.params.id);
        if (!instance) return res.status(404).send();

        await deployInstance(instance);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/instances/:id', async (req, res) => {
    try {
        const instance = await Instance.findById(req.params.id);
        if (!instance) return res.status(404).send();

        // Signal termination
        if (instance.nodeId === 'CORE_LOCAL') {
            const proc = ACTIVE_LOCAL_PROCESSES.get(instance._id.toString());
            if (proc) proc.kill();
            ACTIVE_LOCAL_PROCESSES.delete(instance._id.toString());
        } else {
            const node = await Node.findOne({ identifier: instance.nodeId });
            if (node) {
                try {
                    await axios.post(`http://${node.ip}:4000/kill`, { instanceId: instance._id });
                } catch (e) {
                    console.error(`Failed to kill on remote node ${node.identifier}`);
                }
            }
        }

        await Instance.deleteOne({ _id: req.params.id });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Node Management
app.get('/api/nodes', async (req, res) => {
    try {
        const nodes = await Node.find();
        res.json(nodes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/nodes', async (req, res) => {
    try {
        const node = new Node(req.body);
        await node.save();
        res.status(201).json(node);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/nodes/:id', async (req, res) => {
    try {
        await Node.deleteOne({ _id: req.params.id });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- DEPLOYMENT LOGIC ---

const ACTIVE_LOCAL_PROCESSES = new Map();

async function deployInstance(instance) {
    if (instance.nodeId === 'CORE_LOCAL') {
        spawnLocalBot(instance);
    } else {
        const node = await Node.findOne({ identifier: instance.nodeId });
        if (node) {
            try {
                await axios.post(`http://${node.ip}:4000/spawn`, {
                    username: instance.username,
                    host: instance.host,
                    port: instance.port,
                    instanceId: instance._id,
                    apiServer: process.env.PUBLIC_URL || `http://localhost:${PORT}`
                });
            } catch (e) {
                console.error(`[CORE] Remote spawn failed for ${instance.username} on ${node.identifier}: ${e.message}`);
                throw e;
            }
        } else {
            throw new Error(`Node ${instance.nodeId} not found`);
        }
    }
}

function spawnLocalBot(instance) {
    console.log(`[CORE] Spawning local unit: ${instance.username}`);

    // Kill existing if any
    const existing = ACTIVE_LOCAL_PROCESSES.get(instance._id.toString());
    if (existing) existing.kill();

    const botProcess = spawn('node', [
        path.join(__dirname, 'bot.js'),
        instance.username,
        instance.host,
        instance.port,
        `http://localhost:${PORT}`,
        instance._id
    ], { stdio: 'inherit' });

    ACTIVE_LOCAL_PROCESSES.set(instance._id.toString(), botProcess);

    botProcess.on('exit', () => {
        ACTIVE_LOCAL_PROCESSES.delete(instance._id.toString());
        Instance.findByIdAndUpdate(instance._id, { status: 'offline' }).exec();
        io.emit('bot-update', { instanceId: instance._id, type: 'status', data: 'offline' });
    });
}

// --- NODE HEALTH MONITORING ---

async function monitorNodes() {
    const nodes = await Node.find();
    for (const node of nodes) {
        const res = await ping.promise.probe(node.ip, { timeout: 2 });
        const status = res.alive ? 'online' : 'offline';

        if (node.status !== status) {
            await Node.findByIdAndUpdate(node._id, { status, lastPing: new Date() });
            io.emit('node-update', { identifier: node.identifier, status });
        }
    }
}

setInterval(monitorNodes, 30000); // Every 30 seconds

// --- SOCKET LOGIC ---

io.on('connection', (socket) => {
    console.log('Gateway client connected:', socket.id);

    socket.on('bot-event', (payload) => {
        // Relay bot events (chat, logs, status, map) to web clients
        io.emit('bot-update', payload);

        // Update status in DB
        if (payload.type === 'status') {
            Instance.findByIdAndUpdate(payload.instanceId, { status: payload.data, lastSeen: new Date() }).exec();
        }
    });

    socket.on('send-chat', (payload) => {
        // Forward chat command from web to bots
        io.emit('send-chat', payload);
    });

    socket.on('request-map', (payload) => {
        // Forward map request to bots
        io.emit('request-map', payload);
    });

    socket.on('node-ping', async (payload) => {
        // Handle direct pings from nodes if they use it
        await Node.findOneAndUpdate({ identifier: payload.identifier }, { status: 'online', lastPing: new Date() }).exec();
    });
});

// Fallback for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => console.log(`Nexus Core Gateway active on port ${PORT}`));

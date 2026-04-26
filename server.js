const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus_secret_gateway';

// --- DATABASE CONNECTION ---
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to Nexus Database'))
        .catch(err => console.error('Database connection error:', err));
}

// --- AUTH ENDPOINTS ---
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (password === (process.env.PANEL_PASSWORD || 'admin')) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token });
    }
    res.status(401).json({ error: 'Unauthorized' });
});

// --- NODE MANAGEMENT ---
app.post('/api/nodes/register', auth, async (req, res) => {
    try {
        const node = new Node(req.body);
        await node.save();
        io.emit('nodes-list', await Node.find());
        res.json(node);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/nodes', auth, async (req, res) => {
    const nodes = await Node.find();
    res.json(nodes);
});

// --- DEPLOYMENT LOGIC (LOAD BALANCED) ---
app.post('/api/instances/deploy', auth, async (req, res) => {
    const { username, host, port, category } = req.body;

    // Load Balancing: Find healthy node with least active instances
    const targetNode = await Node.findOne({ status: 'online' }).sort({ activeInstances: 1 });

    if (!targetNode) {
        return res.status(503).json({ error: 'No active VPS nodes available' });
    }

    try {
        // Create instance record
        const instance = new Instance({
            username,
            host,
            port: parseInt(port),
            category,
            nodeId: targetNode._id
        });
        await instance.save();

        // Relay to VPS Listener
        try {
            await axios.post(`http://${targetNode.ip}:4000/deploy`, {
                username, host, port, instanceId: instance._id
            }, {
                headers: { 'x-nexus-key': process.env.NODE_AUTH_KEY },
                timeout: 5000
            });

            targetNode.activeInstances += 1;
            await targetNode.save();

            io.emit('bot-added', instance);
            res.json({ status: 'deployed', instance, targetNode: targetNode.name });
        } catch (relayErr) {
            instance.status = 'error';
            await instance.save();
            throw new Error(`VPS Node Relay Failed: ${relayErr.message}`);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REAL-TIME GATEWAY ---
io.on('connection', (socket) => {
    console.log('Neural Link established');

    // Socket handle for bot deployment from UI
    socket.on('add-bot', async (data) => {
        // Simple internal relay to deployment logic
        // In full production, UI should use the REST API with JWT
        console.log('UI Bot Deployment Request:', data.username);
        // This is a bridge for the current visual panel UI
    });

    socket.on('authenticate', (token) => {
        try {
            jwt.verify(token, JWT_SECRET);
            socket.authenticated = true;
        } catch (e) {
            socket.disconnect();
        }
    });

    // Remote bots connect back here to relay chat
    socket.on('relay-chat', (data) => {
        io.emit('bot-chat', data);
    });

    socket.on('relay-status', (data) => {
        io.emit('bot-status', data);
    });

    socket.on('relay-map', (data) => {
        io.emit('bot-map', data);
    });

    socket.on('disconnect', () => console.log('Neural Link terminated'));
});

server.listen(PORT, () => console.log(`Nexus Core active on port ${PORT}`));

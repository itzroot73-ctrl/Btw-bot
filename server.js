const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const { spawn } = require('child_process');
require('dotenv').config();

// Models
const nodeSchema = new mongoose.Schema({
    name: String,
    ip: String,
    status: { type: String, default: 'offline' },
    lastPing: Date,
    identifier: { type: String, unique: true }
});
const Node = mongoose.model('Node', nodeSchema);

const instanceSchema = new mongoose.Schema({
    username: String,
    host: String,
    port: Number,
    status: { type: String, default: 'offline' },
    nodeId: String,
    category: String,
    lastSeen: Date
});
const Instance = mongoose.model('Instance', instanceSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// --- DATABASE CONNECTION ---
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to Nexus Database'))
        .catch(err => console.error('Database connection error:', err));
}

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
                console.error(`Remote spawn failed: ${e.message}`);
            }
        }
    }
}

function spawnLocalBot(instance) {
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

// --- SOCKET LOGIC ---
io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Emit initial data
    try {
        const allNodes = await Node.find();
        const allInstances = await Instance.find();

        socket.emit('nodes-list', allNodes.map(n => ({
            id: n._id, name: n.name, ip: n.ip, status: n.status, identifier: n.identifier,
            botCount: allInstances.filter(i => i.nodeId === n.identifier).length
        })));

        socket.emit('bots-list', allInstances.map(i => ({
            id: i._id,
            username: i.username,
            host: i.host,
            port: i.port,
            status: i.status,
            category: i.category,
            nodeId: i.nodeId,
            messages: []
        })));
    } catch (e) { console.error(e); }

    socket.on('add-bot', async (data) => {
        try {
            const instance = new Instance(data);
            await instance.save();
            await deployInstance(instance);
            io.emit('bot-added', {
                id: instance._id,
                username: instance.username,
                host: instance.host,
                port: instance.port,
                status: 'connecting',
                category: instance.category,
                nodeId: instance.nodeId,
                messages: []
            });
        } catch (e) { console.error(e); }
    });

    socket.on('remove-bot', async (botId) => {
        try {
            const instance = await Instance.findById(botId);
            if (instance) {
                if (instance.nodeId === 'CORE_LOCAL') {
                    const proc = ACTIVE_LOCAL_PROCESSES.get(instance._id.toString());
                    if (proc) proc.kill();
                }
                await Instance.deleteOne({ _id: botId });
                io.emit('bot-removed', botId);
            }
        } catch (e) { console.error(e); }
    });

    socket.on('bot-event', (payload) => {
        io.emit('bot-update', payload);
        if (payload.type === 'status') {
            Instance.findByIdAndUpdate(payload.instanceId, { status: payload.data, lastSeen: new Date() }).exec();
        }
    });

    socket.on('send-chat', (payload) => {
        io.emit('send-chat', payload);
    });

    socket.on('node-ping', async (payload) => {
        await Node.findOneAndUpdate({ identifier: payload.identifier }, { status: 'online', lastPing: new Date() }).exec();
    });

    socket.on('restart-node-bots', async (nodeId) => {
        try {
            const node = await Node.findById(nodeId);
            const instances = await Instance.find({ nodeId: node ? node.identifier : nodeId });
            for (const instance of instances) {
                await deployInstance(instance);
            }
        } catch (e) { console.error(e); }
    });

    socket.on('add-node', async (data) => {
        try {
            const node = new Node(data);
            await node.save();
            const allNodes = await Node.find();
            const allInstances = await Instance.find();
            io.emit('nodes-list', allNodes.map(n => ({
                id: n._id, name: n.name, ip: n.ip, status: n.status, identifier: n.identifier,
                botCount: allInstances.filter(i => i.nodeId === n.identifier).length
            })));
        } catch (e) { console.error(e); }
    });

    socket.on('remove-node', async (nodeId) => {
        try {
            await Node.deleteOne({ _id: nodeId });
            const allNodes = await Node.find();
            const allInstances = await Instance.find();
            io.emit('nodes-list', allNodes.map(n => ({
                id: n._id, name: n.name, ip: n.ip, status: n.status, identifier: n.identifier,
                botCount: allInstances.filter(i => i.nodeId === n.identifier).length
            })));
        } catch (e) { console.error(e); }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => console.log(`Nexus Core active on ${PORT}`));

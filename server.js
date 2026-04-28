const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const Node = require('./models/Node');
const Instance = require('./models/Instance');
const auth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus_secret_gateway';

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to Nexus Database'))
        .catch(err => console.error('Database connection error:', err));
}

io.on('connection', (socket) => {
    console.log('Neural Link established');

    socket.on('add-bot', async (data) => {
        const targetNode = await Node.findOne({ status: 'online' }).sort({ activeInstances: 1 });
        if (!targetNode) return;
        const instance = new Instance({ ...data, nodeId: targetNode._id });
        await instance.save();
        try {
            await axios.post(`http://${targetNode.ip}:4000/deploy`, { ...data, instanceId: instance._id }, { headers: { 'x-nexus-key': process.env.NODE_AUTH_KEY } });
            targetNode.activeInstances += 1;
            await targetNode.save();
            io.emit('bot-added', instance);
        } catch (e) {}
    });

    socket.on('update-bot-settings', async (data) => {
        const { botId, settings } = data;
        try {
            const instance = await Instance.findByIdAndUpdate(botId, { settings }, { new: true }).populate('nodeId');
            if (instance && instance.nodeId) {
                await axios.post(`http://${instance.nodeId.ip}:4000/update-settings`, { instanceId: botId, settings }, { headers: { 'x-nexus-key': process.env.NODE_AUTH_KEY } }).catch(() => {});
            }
            io.emit('bot-settings-updated', { botId, settings });
        } catch (err) {}
    });

    socket.on('send-chat', async (data) => {
        const instance = await Instance.findById(data.botId).populate('nodeId');
        if (instance && instance.nodeId) {
            await axios.post(`http://${instance.nodeId.ip}:4000/send-chat`, { instanceId: data.botId, message: data.message }, { headers: { 'x-nexus-key': process.env.NODE_AUTH_KEY } }).catch(() => {});
        }
    });

    socket.on('relay-chat', (data) => io.emit('bot-chat', data));
    socket.on('relay-status', (data) => io.emit('bot-status', data));
    socket.on('relay-esp-data', (data) => io.emit('relay-esp-data', data));
    socket.on('relay-map', (data) => io.emit('bot-map', data));
    socket.on('disconnect', () => console.log('Neural Link terminated'));
});

server.listen(PORT, () => console.log(`Nexus Core active on port ${PORT}`));

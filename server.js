const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { fork } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

class BotManager {
    constructor() {
        this.bots = new Map();
        this.nodes = [];
    }

    addNode(node) {
        const newNode = {
            id: `node-${Date.now()}`,
            name: node.name,
            ip: node.ip
        };
        this.nodes.push(newNode);
        return newNode;
    }

    removeNode(nodeId) {
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        return true;
    }

    getAllNodes() {
        return this.nodes;
    }

    addBot(options) {
        const { username, host, port, category, nodeId } = options;
        const actualUsername = username || `Bot_${Math.floor(Math.random() * 1000)}`;
        const botId = `${actualUsername}-${host}-${Date.now()}`;

        // Spawn bot as a separate process using bot.js
        const child = fork(path.join(__dirname, 'bot.js'), [JSON.stringify({
            host: host || 'play.bananasmp.net',
            port: port || 25565,
            username: actualUsername
        })]);

        const botData = {
            id: botId,
            username: actualUsername,
            host: host || 'play.bananasmp.net',
            port: port || 25565,
            category: category || 'Default',
            nodeId: nodeId || 'CORE_LOCAL',
            status: 'connecting',
            messages: []
        };

        this.bots.set(botId, { child, data: botData });

        child.on('message', (msg) => {
            if (msg.type === 'status') {
                botData.status = msg.status;
                if (msg.username) botData.username = msg.username;
                io.emit('bot-status', botData);
            } else if (msg.type === 'chat') {
                const chatMsg = {
                    username: msg.username,
                    message: msg.message,
                    time: msg.time
                };
                botData.messages.push(chatMsg);
                if (botData.messages.length > 100) botData.messages.shift();
                io.emit('bot-chat', { botId, msg: chatMsg });
            }
        });

        child.on('exit', () => {
            if (this.bots.has(botId)) {
                botData.status = 'offline';
                io.emit('bot-status', botData);
            }
        });

        return botData;
    }

    getBot(botId) {
        return this.bots.get(botId);
    }

    getAllBots() {
        return Array.from(this.bots.values()).map(b => b.data);
    }

    removeBot(botId) {
        const botInstance = this.bots.get(botId);
        if (botInstance) {
            botInstance.child.kill();
            this.bots.delete(botId);
            return true;
        }
        return false;
    }
}

const botManager = new BotManager();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.emit('bots-list', botManager.getAllBots());
    socket.emit('nodes-list', botManager.getAllNodes());

    socket.on('add-bot', (options) => {
        const botData = botManager.addBot(options);
        io.emit('bot-added', botData);
    });

    socket.on('send-chat', ({ botId, message }) => {
        const botInstance = botManager.getBot(botId);
        if (botInstance && botInstance.data.status === 'online') {
            botInstance.child.send({ type: 'send-chat', message });
        }
    });

    socket.on('remove-bot', (botId) => {
        if (botManager.removeBot(botId)) {
            io.emit('bot-removed', botId);
        }
    });

    socket.on('add-node', (nodeData) => {
        botManager.addNode(nodeData);
        io.emit('nodes-list', botManager.getAllNodes());
    });

    socket.on('remove-node', (nodeId) => {
        botManager.removeNode(nodeId);
        io.emit('nodes-list', botManager.getAllNodes());
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

class BotManager {
    constructor() {
        this.bots = new Map();
    }

    addBot(options) {
        const { username, host, port, category } = options;
        const actualUsername = username || `Bot_${Math.floor(Math.random() * 1000)}`;
        const botId = `${actualUsername}-${host}-${Date.now()}`;

        const bot = mineflayer.createBot({
            host: host || 'play.bananasmp.net',
            port: port || 25565,
            username: actualUsername,
        });

        const botData = {
            id: botId,
            username: actualUsername,
            host: host || 'play.bananasmp.net',
            port: port || 25565,
            category: category || 'Default',
            status: 'connecting',
            messages: []
        };

        this.bots.set(botId, { bot, data: botData });

        bot.on('login', () => {
            botData.status = 'online';
            botData.username = bot.username;
            io.emit('bot-status', botData);
        });

        bot.on('chat', (username, message) => {
            const msg = { username, message, time: new Date().toLocaleTimeString() };
            botData.messages.push(msg);
            if (botData.messages.length > 100) botData.messages.shift();
            io.emit('bot-chat', { botId, msg });
        });

        bot.on('error', (err) => {
            botData.status = 'error';
            io.emit('bot-status', botData);
            console.error(`Bot ${username} error:`, err);
        });

        bot.on('end', () => {
            botData.status = 'offline';
            io.emit('bot-status', botData);
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
            botInstance.bot.quit();
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

    socket.on('add-bot', (options) => {
        const botData = botManager.addBot(options);
        io.emit('bot-added', botData);
    });

    socket.on('send-chat', ({ botId, message }) => {
        const botInstance = botManager.getBot(botId);
        if (botInstance && botInstance.data.status === 'online') {
            botInstance.bot.chat(message);
        }
    });

    socket.on('remove-bot', (botId) => {
        if (botManager.removeBot(botId)) {
            io.emit('bot-removed', botId);
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

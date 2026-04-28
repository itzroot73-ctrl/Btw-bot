const mineflayer = require('mineflayer');
const io = require('socket.io-client');

// CLI Arguments: username host port apiServer instanceId
const username = process.argv[2];
const host = process.argv[3];
const port = parseInt(process.argv[4]);
const apiServer = process.argv[5];
const instanceId = process.argv[6];

console.log(`[BOT] Initializing: ${username} @ ${host}:${port}`);

const socket = io(apiServer);

const bot = mineflayer.createBot({
    host: host,
    port: port,
    username: username,
    version: false // Auto-detect version
});

function emitEvent(type, data) {
    socket.emit('bot-event', {
        instanceId: instanceId,
        type: type,
        data: data
    });
}

bot.on('login', () => {
    console.log(`[BOT] ${username} Logged in`);
    emitEvent('status', 'online');
});

bot.on('chat', (sender, message) => {
    emitEvent('chat', {
        username: sender,
        message: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
});

bot.on('map_data', (data) => {
    // Only send the color data if it exists
    if (data.colors) {
        emitEvent('map', Array.from(data.colors));
    }
});

bot.on('error', (err) => {
    console.error(`[BOT] ${username} Error: `, err);
    emitEvent('status', 'error');
});

bot.on('kicked', (reason) => {
    console.warn(`[BOT] ${username} Kicked: `, reason);
    emitEvent('status', 'offline');
});

bot.on('end', () => {
    console.log(`[BOT] ${username} Connection closed`);
    emitEvent('status', 'offline');
});

socket.on('send-chat', (payload) => {
    if (payload.botId === instanceId) {
        bot.chat(payload.message);
    }
});

socket.on('request-map', (payload) => {
    if (payload.botId === instanceId) {
        // Map is sent automatically on update by mineflayer
    }
});

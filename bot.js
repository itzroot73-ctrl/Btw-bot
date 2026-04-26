const mineflayer = require('mineflayer');
const io = require('socket.io-client');

// Get configuration from parent process or environment
const options = JSON.parse(process.argv[2]);
const CORE_URL = process.env.CORE_URL; // Used if running in distributed mode

let socket;
if (CORE_URL) {
    socket = io(CORE_URL);
}

const bot = mineflayer.createBot({
    host: options.host || 'play.bananasmp.net',
    port: options.port || 25565,
    username: options.username,
});

function emitEvent(type, data) {
    if (process.send) {
        // Parent process (node-listener or local server)
        process.send({ type, ...data });
    }
    if (socket) {
        // Remote Core Controller
        socket.emit(`relay-${type}`, { botId: options.instanceId, ...data });
    }
}

bot.on('login', () => {
    emitEvent('status', { status: 'online', username: bot.username });
});

bot.on('chat', (username, message) => {
    const msg = {
        username,
        message,
        time: new Date().toLocaleTimeString()
    };
    emitEvent('chat', { msg });
});

bot.on('error', (err) => {
    emitEvent('status', { status: 'error', error: err.message });
});

bot.on('end', () => {
    emitEvent('status', { status: 'offline' });
});

// Listen for messages from parent (e.g., to send chat)
process.on('message', (msg) => {
    if (msg.type === 'send-chat' && bot) {
        bot.chat(msg.message);
    }
});

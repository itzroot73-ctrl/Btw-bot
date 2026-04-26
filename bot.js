const mineflayer = require('mineflayer');

// Get configuration from parent process
const options = JSON.parse(process.argv[2]);

const bot = mineflayer.createBot({
    host: options.host || 'play.bananasmp.net',
    port: options.port || 25565,
    username: options.username,
});

bot.on('login', () => {
    process.send({ type: 'status', status: 'online', username: bot.username });
});

bot.on('chat', (username, message) => {
    process.send({
        type: 'chat',
        username,
        message,
        time: new Date().toLocaleTimeString()
    });
});

bot.on('error', (err) => {
    process.send({ type: 'status', status: 'error', error: err.message });
});

bot.on('end', () => {
    process.send({ type: 'status', status: 'offline' });
});

// Listen for messages from parent (e.g., to send chat)
process.on('message', (msg) => {
    if (msg.type === 'send-chat' && bot) {
        bot.chat(msg.message);
    }
});

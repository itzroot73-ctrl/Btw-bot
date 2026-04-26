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
    version: options.version || false // Auto-detect
});

// --- KILL AURA STATE ---
let killaura = {
    enabled: false,
    range: 3.8,
    speed: 10, // APS
    lastAttack: 0
};

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

// Capture Map Data
bot.on('map', (data) => {
    if (data.colors) {
        emitEvent('map', { colors: Array.from(data.colors) });
    }
});

// --- COMBAT LOOP ---
bot.on('physicsTick', () => {
    if (!killaura.enabled) return;

    const now = Date.now();
    const attackDelay = 1000 / killaura.speed;

    if (now - killaura.lastAttack < attackDelay) return;

    const target = bot.nearestEntity((entity) => {
        // Target players and hostiles
        if (entity.type === 'player' && entity.username !== bot.username) return true;
        if (entity.type === 'mob' || entity.type === 'hostile') return true;
        return false;
    });

    if (target) {
        const dist = bot.entity.position.distanceTo(target.position);
        if (dist <= killaura.range) {
            // Add a tiny jitter to look more "legit"
            const jitter = Math.random() * 50;
            if (now - killaura.lastAttack < attackDelay + jitter) return;

            bot.lookAt(target.position.offset(0, target.height, 0));
            bot.attack(target);
            bot.swingArm();
            killaura.lastAttack = now;
        }
    }
});

// Listen for messages from parent (e.g., to send chat or update settings)
process.on('message', (msg) => {
    if (msg.type === 'send-chat' && bot) {
        bot.chat(msg.message);
    }
    if (msg.type === 'update-settings') {
        if (msg.settings) {
            killaura.enabled = msg.settings.killauraEnabled ?? killaura.enabled;
            killaura.range = msg.settings.killauraRange ?? killaura.range;
            killaura.speed = msg.settings.killauraSpeed ?? killaura.speed;

            console.log(`[${bot.username}] SETTINGS_UPDATED: Killaura=${killaura.enabled} Range=${killaura.range} Speed=${killaura.speed}`);
        }
    }
});

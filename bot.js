const mineflayer = require('mineflayer');
const io = require('socket.io-client');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

// Get configuration from parent process or environment
const options = JSON.parse(process.argv[2]);
const CORE_URL = process.env.CORE_URL;

let socket;
if (CORE_URL) {
    socket = io(CORE_URL);
}

const bot = mineflayer.createBot({
    host: options.host || 'play.bananasmp.net',
    port: options.port || 25565,
    username: options.username,
    version: options.version || false
});

bot.loadPlugin(pathfinder);

// --- FULL SYSTEM STATE ---
let state = {
    settings: {
        killauraEnabled: false,
        killauraRange: 3.8,
        killauraSpeed: 12,
        triggerbotEnabled: false,
        aimassistEnabled: false,
        aimassistSpeed: 0.1,
        espEnabled: false,
        espPlayers: true,
        espMobs: false,
        autoeatEnabled: true,
        autoarmorEnabled: true,
        autosprintEnabled: true,
        sneakEnabled: false
    },
    lastAttack: 0,
    lastEspEmit: 0
};

function emitEvent(type, data) {
    if (process.send) process.send({ type, ...data });
    if (socket) socket.emit(`relay-${type}`, { botId: options.instanceId, ...data });
}

bot.on('login', () => {
    emitEvent('status', { status: 'online', username: bot.username });
});

bot.on('error', (err) => {
    emitEvent('status', { status: 'error', error: err.message });
});

bot.on('end', () => {
    emitEvent('status', { status: 'offline' });
});

bot.on('map', (data) => {
    if (data.colors) emitEvent('map', { colors: Array.from(data.colors) });
});

// --- CORE MODULES ---

// 1. Combat Module
function handleCombat() {
    const now = Date.now();
    const { settings } = state;

    // Aim Assist
    if (settings.aimassistEnabled) {
        const target = bot.nearestEntity((e) => e.type === 'player' && e.username !== bot.username && bot.entity.position.distanceTo(e.position) < 6);
        if (target) {
            const pos = target.position.offset(0, target.height, 0);
            bot.lookAt(pos, false); // Smooth look handled by mineflayer internal tick if second arg is false (or use custom smooth rotation)
        }
    }

    // Trigger Bot
    if (settings.triggerbotEnabled) {
        const entity = bot.entityAtCursor(4);
        if (entity && (entity.type === 'player' || entity.type === 'mob')) {
            if (now - state.lastAttack > (1000 / 10)) { // 10 CPS fixed for trigger
                bot.attack(entity);
                bot.swingArm();
                state.lastAttack = now;
            }
        }
    }

    // Kill Aura
    if (settings.killauraEnabled) {
        const attackDelay = 1000 / settings.killauraSpeed;
        if (now - state.lastAttack >= attackDelay) {
            const target = bot.nearestEntity((e) => {
                if (e.type === 'player' && e.username !== bot.username) return true;
                if (e.type === 'mob' || e.type === 'hostile') return true;
                return false;
            });

            if (target && bot.entity.position.distanceTo(target.position) <= settings.killauraRange) {
                const jitter = Math.random() * 30;
                if (now - state.lastAttack < attackDelay + jitter) return;

                bot.lookAt(target.position.offset(0, target.height * 0.8, 0));
                bot.attack(target);
                bot.swingArm();
                state.lastAttack = now;
            }
        }
    }
}

// 2. Utility Module
function handleUtility() {
    const { settings } = state;

    // Auto Armor
    if (settings.autoarmorEnabled && bot.inventory) {
        const armorSlots = [8, 7, 6, 5]; // feet, legs, chest, head
        // Simplified auto-armor logic
        const items = bot.inventory.items();
        items.forEach(item => {
            if (item.name.includes('helmet') && !bot.inventory.slots[5]) bot.equip(item, 'head');
            if (item.name.includes('chestplate') && !bot.inventory.slots[6]) bot.equip(item, 'chest');
            if (item.name.includes('leggings') && !bot.inventory.slots[7]) bot.equip(item, 'legs');
            if (item.name.includes('boots') && !bot.inventory.slots[8]) bot.equip(item, 'feet');
        });
    }

    // Auto Eat
    if (settings.autoeatEnabled && bot.food < 18) {
        const food = bot.inventory.items().find(item => item.name.includes('cooked') || item.name === 'apple' || item.name === 'bread');
        if (food) bot.eat(food).catch(() => {});
    }

    // Movement
    bot.setControlState('sprint', settings.autosprintEnabled);
    bot.setControlState('sneak', settings.sneakEnabled);
}

// 3. Visuals Module (ESP Relay)
function handleVisuals() {
    const now = Date.now();
    if (state.settings.espEnabled && now - state.lastEspEmit > 500) {
        const entities = Object.values(bot.entities)
            .filter(e => {
                if (e.id === bot.entity.id) return false;
                if (e.type === 'player' && state.settings.espPlayers) return true;
                if (e.type === 'mob' && state.settings.espMobs) return true;
                return false;
            })
            .map(e => ({
                id: e.id,
                type: e.type,
                name: e.username || e.name,
                pos: e.position,
                dist: bot.entity.position.distanceTo(e.position)
            }));

        emitEvent('esp-data', { entities });
        state.lastEspEmit = now;
    }
}

bot.on('physicsTick', () => {
    handleCombat();
    handleUtility();
    handleVisuals();
});

// --- COMMAND HANDLING ---
process.on('message', (msg) => {
    if (msg.type === 'send-chat' && bot) bot.chat(msg.message);
    if (msg.type === 'update-settings') {
        state.settings = { ...state.settings, ...msg.settings };
        console.log(`[${bot.username}] MODULES_RECONFIGURED`);
    }
});

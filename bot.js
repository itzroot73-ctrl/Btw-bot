const mineflayer = require('mineflayer');
const io = require('socket.io-client');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

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

let state = {
    settings: {
        killauraEnabled: false,
        killauraRange: 3.8,
        killauraSpeed: 12,
        triggerbotEnabled: false,
        aimassistEnabled: false,
        aimassistSpeed: 0.1,
        velocityEnabled: false,
        espEnabled: false,
        targetEspEnabled: true,
        espPlayers: true,
        espMobs: false,
        autoeatEnabled: true,
        autoarmorEnabled: true,
        autototemEnabled: true,
        nofallEnabled: false,
        autosprintEnabled: true,
        sneakEnabled: false,
        speedEnabled: false
    },
    lastAttack: 0,
    lastEspEmit: 0,
    currentTargetId: null
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

bot.on('packet', (data, metadata) => {
    if (metadata.name === 'entity_velocity' && state.settings.velocityEnabled) {
        if (data.entityId === bot.entity.id) state.shouldResetVelocity = true;
    }
});

function handleCombat() {
    const now = Date.now();
    const { settings } = state;

    if (state.shouldResetVelocity && settings.velocityEnabled) {
        bot.entity.velocity.set(0, bot.entity.velocity.y, 0);
        state.shouldResetVelocity = false;
    }

    // Target Selection
    let target = null;
    if (settings.killauraEnabled) {
        target = bot.nearestEntity((e) => {
            if (e.type === 'player' && e.username !== bot.username) return true;
            if (e.type === 'mob' || e.type === 'hostile') return true;
            return false;
        });

        if (target && bot.entity.position.distanceTo(target.position) > settings.killauraRange) {
            target = null;
        }
    }

    state.currentTargetId = target ? target.id : null;

    if (target && settings.killauraEnabled) {
        const attackDelay = 1000 / settings.killauraSpeed;
        if (now - state.lastAttack >= attackDelay) {
            bot.lookAt(target.position.offset(0, target.height * 0.8, 0));
            bot.attack(target);
            bot.swingArm();
            state.lastAttack = now;
        }
    }

    if (!target && settings.aimassistEnabled) {
        const assistTarget = bot.nearestEntity((e) => e.type === 'player' && e.username !== bot.username && bot.entity.position.distanceTo(e.position) < 6);
        if (assistTarget) bot.lookAt(assistTarget.position.offset(0, assistTarget.height, 0), false);
    }

    if (settings.triggerbotEnabled) {
        const cursorEntity = bot.entityAtCursor(4);
        if (cursorEntity && (cursorEntity.type === 'player' || cursorEntity.type === 'mob')) {
            if (now - state.lastAttack > 100) {
                bot.attack(cursorEntity);
                bot.swingArm();
                state.lastAttack = now;
            }
        }
    }
}

function handleUtility() {
    const { settings } = state;
    if (settings.nofallEnabled && bot.entity.velocity.y < -0.6) bot.entity.onGround = true;
    if (settings.autototemEnabled && bot.health < 10 && bot.inventory) {
        const totem = bot.inventory.items().find(i => i.name === 'totem_of_undying');
        if (totem && (!bot.inventory.slots[45] || bot.inventory.slots[45].name !== 'totem_of_undying')) bot.equip(totem, 'off-hand').catch(() => {});
    }
    if (settings.autoarmorEnabled && bot.inventory) {
        const items = bot.inventory.items();
        items.forEach(item => {
            if (item.name.includes('helmet') && !bot.inventory.slots[5]) bot.equip(item, 'head');
            if (item.name.includes('chestplate') && !bot.inventory.slots[6]) bot.equip(item, 'chest');
            if (item.name.includes('leggings') && !bot.inventory.slots[7]) bot.equip(item, 'legs');
            if (item.name.includes('boots') && !bot.inventory.slots[8]) bot.equip(item, 'feet');
        });
    }
    if (settings.autoeatEnabled && bot.food < 18) {
        const food = bot.inventory.items().find(item => item.name.includes('cooked') || item.name === 'apple' || item.name === 'bread');
        if (food) bot.eat(food).catch(() => {});
    }
    bot.setControlState('sprint', settings.autosprintEnabled);
    bot.setControlState('sneak', settings.sneakEnabled);
    if (settings.speedEnabled) { bot.setControlState('forward', true); bot.setControlState('sprint', true); }
}

function handleVisuals() {
    const now = Date.now();
    if ((state.settings.espEnabled || state.settings.targetEspEnabled) && now - state.lastEspEmit > 500) {
        const entities = Object.values(bot.entities)
            .filter(e => e.id !== bot.entity.id)
            .filter(e => {
                if (e.id === state.currentTargetId) return true; // Always include target
                if (!state.settings.espEnabled) return false;
                return (e.type === 'player' && state.settings.espPlayers) || (e.type === 'mob' && state.settings.espMobs);
            })
            .map(e => ({
                id: e.id,
                type: e.type,
                name: e.username || e.name,
                pos: e.position,
                dist: bot.entity.position.distanceTo(e.position),
                isTarget: e.id === state.currentTargetId
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

process.on('message', (msg) => {
    if (msg.type === 'send-chat' && bot) bot.chat(msg.message);
    if (msg.type === 'update-settings') {
        state.settings = { ...state.settings, ...msg.settings };
        console.log(`[${bot.username}] MODULES_RECONFIGURED`);
    }
});

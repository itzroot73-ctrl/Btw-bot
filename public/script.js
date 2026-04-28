const socket = io();
let bots = [];
let selectedBotId = null;

const botsGrid = document.getElementById('bots-grid');
const botCount = document.getElementById('bot-count');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const noBotSelected = document.getElementById('no-bot-selected');
const activeInterface = document.getElementById('active-interface');

const nexusHub = document.getElementById('nexus-hub');
const closeHub = document.getElementById('close-hub');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// --- HUB LOGIC ---

function toggleHub() {
    if (!selectedBotId) return;
    if (nexusHub.classList.contains('hidden')) {
        syncHubUI();
        nexusHub.classList.remove('hidden');
        setTimeout(() => nexusHub.classList.add('active', 'opacity-100'), 10);
    } else {
        nexusHub.classList.remove('active', 'opacity-100');
        setTimeout(() => nexusHub.classList.add('hidden'), 400);
    }
}

tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active-tab'));
        tabContents.forEach(c => c.classList.add('hidden'));
        btn.classList.add('active-tab');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    };
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'ShiftRight') { e.preventDefault(); toggleHub(); }
    if (e.code === 'KeyR' && selectedBotId) { toggleSetting('killauraEnabled'); }
    if (e.code === 'KeyG' && selectedBotId) { toggleSetting('espEnabled'); }
    if (e.code === 'KeyV' && selectedBotId) { toggleSetting('velocityEnabled'); }
});

function toggleSetting(key) {
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;
    const newSettings = { ...bot.settings, [key]: !bot.settings[key] };
    updateBotSettings(newSettings);
}

function syncHubUI() {
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot || !bot.settings) return;
    const s = bot.settings;

    document.getElementById('killaura-toggle').checked = s.killauraEnabled;
    document.getElementById('killaura-range').value = s.killauraRange;
    document.getElementById('velocity-toggle').checked = s.velocityEnabled;
    document.getElementById('triggerbot-toggle').checked = s.triggerbotEnabled;
    document.getElementById('aimassist-toggle').checked = s.aimassistEnabled;
    document.getElementById('esp-toggle').checked = s.espEnabled;
    document.getElementById('autototem-toggle').checked = s.autototemEnabled;
    document.getElementById('nofall-toggle').checked = s.nofallEnabled;
    document.getElementById('autoeat-toggle').checked = s.autoeatEnabled;
    document.getElementById('autoarmor-toggle').checked = s.autoarmorEnabled;
    document.getElementById('speed-toggle').checked = s.speedEnabled;
    document.getElementById('autosprint-toggle').checked = s.autosprintEnabled;
}

function updateBotSettings(settings) {
    socket.emit('update-bot-settings', { botId: selectedBotId, settings });
}

// Input listeners
const setupListener = (id, key, isFloat = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = (e) => updateBotSettings({ [key]: el.type === 'checkbox' ? e.target.checked : (isFloat ? parseFloat(e.target.value) : e.target.value) });
};

setupListener('killaura-toggle', 'killauraEnabled');
setupListener('killaura-range', 'killauraRange', true);
setupListener('velocity-toggle', 'velocityEnabled');
setupListener('triggerbot-toggle', 'triggerbotEnabled');
setupListener('aimassist-toggle', 'aimassistEnabled');
setupListener('esp-toggle', 'espEnabled');
setupListener('autototem-toggle', 'autototemEnabled');
setupListener('nofall-toggle', 'nofallEnabled');
setupListener('autoeat-toggle', 'autoeatEnabled');
setupListener('autoarmor-toggle', 'autoarmorEnabled');
setupListener('speed-toggle', 'speedEnabled');
setupListener('autosprint-toggle', 'autosprintEnabled');

closeHub.onclick = toggleHub;

// --- CORE PANEL LOGIC ---

socket.on('bot-added', (bot) => {
    bots.push({ ...bot, messages: [], status: 'deploying', settings: bot.settings || {} });
    updateSidebar();
});

socket.on('bot-status', (data) => {
    const bot = bots.find(b => b.id === data.botId);
    if (bot) {
        bot.status = data.status;
        if (selectedBotId === bot.id) updateBotHeader();
        updateSidebar();
    }
});

socket.on('bot-chat', (data) => {
    const bot = bots.find(b => b.id === data.botId);
    if (bot) {
        bot.messages.push(data.msg);
        if (selectedBotId === bot.id) appendChat(data.msg);
    }
});

socket.on('bot-settings-updated', (data) => {
    const bot = bots.find(b => b.id === data.botId);
    if (bot) {
        bot.settings = data.settings;
        if (selectedBotId === bot.id) syncHubUI();
    }
});

socket.on('relay-esp-data', (data) => {
    if (selectedBotId === data.botId) renderESP(data.entities);
});

function renderESP(entities) {
    const espList = document.getElementById('esp-list');
    const header = espList.querySelector('h3');
    espList.innerHTML = '';
    espList.appendChild(header);
    entities.forEach(e => {
        const div = document.createElement('div');
        div.className = 'bg-white/[0.02] border border-white/5 p-3 rounded-xl flex justify-between items-center';
        div.innerHTML = `<div><p class="text-[9px] font-black text-white/80 uppercase">${e.name || e.type}</p></div>`;
        espList.appendChild(div);
    });
}

function updateSidebar() {
    botsGrid.innerHTML = '';
    botCount.textContent = bots.length.toString().padStart(2, '0');
    bots.forEach(bot => {
        const card = document.createElement('div');
        card.className = `bot-card p-6 border border-white/5 rounded-2xl cursor-pointer ${selectedBotId === bot.id ? 'active' : ''}`;
        card.innerHTML = `<span class="text-[10px] font-black uppercase">${bot.username}</span>`;
        card.onclick = () => selectBot(bot.id);
        botsGrid.appendChild(card);
    });
}

function selectBot(id) {
    selectedBotId = id;
    const bot = bots.find(b => b.id === id);
    noBotSelected.classList.add('hidden');
    activeInterface.classList.remove('hidden');
    chatWindow.innerHTML = '';
    bot.messages.forEach(appendChat);
    updateBotHeader();
    updateSidebar();
}

function updateBotHeader() {
    const bot = bots.find(b => b.id === selectedBotId);
    document.getElementById('active-bot-name').textContent = bot.username;
    document.getElementById('bot-status-dot').className = `w-2 h-2 rounded-full status-${bot.status}`;
}

function appendChat(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="text-white/30 text-[9px] font-black mr-2 uppercase">${msg.username}:</span><span class="text-white/80">${msg.message}</span>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

sendChatBtn.onclick = () => {
    const msg = chatInput.value.trim();
    if (msg && selectedBotId) {
        socket.emit('send-chat', { botId: selectedBotId, message: msg });
        chatInput.value = '';
    }
};

document.getElementById('add-bot-btn').onclick = () => document.getElementById('add-bot-modal').classList.remove('hidden');
document.getElementById('close-modal').onclick = () => document.getElementById('add-bot-modal').classList.add('hidden');
document.getElementById('add-bot-form').onsubmit = (e) => {
    e.preventDefault();
    socket.emit('add-bot', { username: document.getElementById('username').value, host: document.getElementById('host').value, port: 25565 });
    document.getElementById('add-bot-modal').classList.add('hidden');
};

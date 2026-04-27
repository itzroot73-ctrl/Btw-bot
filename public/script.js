const socket = io();
let bots = [];
let selectedBotId = null;

// DOM Elements
const botsGrid = document.getElementById('bots-grid');
const botCount = document.getElementById('bot-count');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const noBotSelected = document.getElementById('no-bot-selected');
const activeInterface = document.getElementById('active-interface');

const addBotBtn = document.getElementById('add-bot-btn');
const addBotModal = document.getElementById('add-bot-modal');
const closeBotModal = document.getElementById('close-modal');
const addBotForm = document.getElementById('add-bot-form');

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

// Tab Switching
tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active-tab'));
        tabContents.forEach(c => c.classList.add('hidden'));
        btn.classList.add('active-tab');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    };
});

// Keybinds
window.addEventListener('keydown', (e) => {
    if (e.code === 'ShiftRight') { e.preventDefault(); toggleHub(); }
    if (e.code === 'KeyR' && selectedBotId) { toggleSetting('killauraEnabled'); }
    if (e.code === 'KeyG' && selectedBotId) { toggleSetting('espEnabled'); }
    if (e.code === 'KeyD' && selectedBotId) { toggleSetting('triggerbotEnabled'); }
});

function toggleSetting(key) {
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;
    const newSettings = { ...bot.settings, [key]: !bot.settings[key] };
    updateBotSettings(newSettings);
}

// Sync UI with Bot Data
function syncHubUI() {
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot || !bot.settings) return;

    const s = bot.settings;
    document.getElementById('killaura-toggle').checked = s.killauraEnabled;
    document.getElementById('killaura-range').value = s.killauraRange;
    document.getElementById('range-val').textContent = `${s.killauraRange}M`;
    document.getElementById('triggerbot-toggle').checked = s.triggerbotEnabled;
    document.getElementById('aimassist-toggle').checked = s.aimassistEnabled;
    document.getElementById('esp-toggle').checked = s.espEnabled;
    document.getElementById('autoeat-toggle').checked = s.autoeatEnabled;
    document.getElementById('autoarmor-toggle').checked = s.autoarmorEnabled;
    document.getElementById('autosprint-toggle').checked = s.autosprintEnabled;
}

function updateBotSettings(settings) {
    socket.emit('update-bot-settings', { botId: selectedBotId, settings });
}

// Attach Input Listeners
document.getElementById('killaura-toggle').onchange = (e) => updateBotSettings({ killauraEnabled: e.target.checked });
document.getElementById('killaura-range').oninput = (e) => {
    document.getElementById('range-val').textContent = `${e.target.value}M`;
    updateBotSettings({ killauraRange: parseFloat(e.target.value) });
};
document.getElementById('triggerbot-toggle').onchange = (e) => updateBotSettings({ triggerbotEnabled: e.target.checked });
document.getElementById('aimassist-toggle').onchange = (e) => updateBotSettings({ aimassistEnabled: e.target.checked });
document.getElementById('esp-toggle').onchange = (e) => updateBotSettings({ espEnabled: e.target.checked });
document.getElementById('autoeat-toggle').onchange = (e) => updateBotSettings({ autoeatEnabled: e.target.checked });
document.getElementById('autoarmor-toggle').onchange = (e) => updateBotSettings({ autoarmorEnabled: e.target.checked });
document.getElementById('autosprint-toggle').onchange = (e) => updateBotSettings({ autosprintEnabled: e.target.checked });

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
        div.innerHTML = `
            <div>
                <p class="text-[9px] font-black tracking-widest text-white/80 uppercase">${e.name || e.type}</p>
                <p class="text-[6px] text-white/20 font-black tracking-widest uppercase mt-1">${e.type} // DIST: ${e.dist.toFixed(1)}M</p>
            </div>
            <div class="w-1 h-1 rounded-full bg-white/20"></div>
        `;
        espList.appendChild(div);
    });
}

function updateSidebar() {
    botsGrid.innerHTML = '';
    botCount.textContent = bots.length.toString().padStart(2, '0');
    bots.forEach(bot => {
        const card = document.createElement('div');
        card.className = `bot-card p-6 border border-white/5 rounded-2xl cursor-pointer ${selectedBotId === bot.id ? 'active' : ''}`;
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-[10px] font-black tracking-widest uppercase">${bot.username}</span>
                <div class="w-1.5 h-1.5 rounded-full status-${bot.status}"></div>
            </div>
        `;
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
    document.getElementById('active-bot-ip').textContent = `${bot.host}:${bot.port}`;
    document.getElementById('bot-status-dot').className = `w-2 h-2 rounded-full status-${bot.status}`;
}

function appendChat(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
        <span class="text-white/10 text-[9px] mr-4 font-black">${msg.time}</span>
        <span class="text-white/30 text-[9px] font-black mr-2 uppercase">${msg.username}:</span>
        <span class="text-white/80">${msg.message}</span>
    `;
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

addBotBtn.onclick = () => addBotModal.classList.remove('hidden');
closeBotModal.onclick = () => addBotModal.classList.add('hidden');
addBotForm.onsubmit = (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById('username').value,
        host: document.getElementById('host').value,
        port: 25565
    };
    socket.emit('add-bot', data);
    addBotModal.classList.add('hidden');
};

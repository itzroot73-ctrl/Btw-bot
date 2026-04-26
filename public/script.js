const socket = io();

// DOM Elements
const botForm = document.getElementById('add-bot-form');
const botsGrid = document.getElementById('bots-grid');
const categoryFilters = document.getElementById('category-filters');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const addBotTrigger = document.getElementById('add-bot-trigger');
const addBotModal = document.getElementById('add-bot-modal');
const closeModal = document.getElementById('close-modal');
const noBotSelected = document.getElementById('no-bot-selected');
const chatContainer = document.getElementById('chat-container');
const activeBotName = document.getElementById('active-bot-name');
const activeBotIp = document.getElementById('active-bot-ip');
const botStatusIndicator = document.getElementById('bot-status-indicator');
const removeBotBtn = document.getElementById('remove-bot-btn');

let bots = [];
let selectedBotId = null;
let currentFilter = 'all';

// Modal Controls
addBotTrigger.onclick = () => addBotModal.classList.remove('hidden');
closeModal.onclick = () => addBotModal.classList.add('hidden');
addBotModal.onclick = (e) => { if (e.target === addBotModal) addBotModal.classList.add('hidden'); };

// Form Submission
botForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById('username').value,
        host: document.getElementById('host').value || 'play.bananasmp.net',
        port: parseInt(document.getElementById('port').value) || 25565,
        category: document.getElementById('category').value || 'Default'
    };
    socket.emit('add-bot', data);
    botForm.reset();
    addBotModal.classList.add('hidden');
});

// Socket Events
socket.on('bots-list', (botList) => {
    bots = botList;
    renderBots();
    renderFilters();
});

socket.on('bot-added', (bot) => {
    bots.push(bot);
    renderBots();
    renderFilters();
});

socket.on('bot-status', (updatedBot) => {
    const index = bots.findIndex(b => b.id === updatedBot.id);
    if (index !== -1) {
        bots[index] = { ...bots[index], ...updatedBot };
        renderBots();
        if (selectedBotId === updatedBot.id) {
            updateChatHeader();
            updateChatControls();
        }
    }
});

socket.on('bot-chat', ({ botId, msg }) => {
    const bot = bots.find(b => b.id === botId);
    if (bot) {
        bot.messages.push(msg);
        if (bot.messages.length > 100) bot.messages.shift();
        if (selectedBotId === botId) {
            appendChatMessage(msg);
        }
    }
});

socket.on('bot-removed', (botId) => {
    bots = bots.filter(b => b.id !== botId);
    if (selectedBotId === botId) {
        selectedBotId = null;
        chatContainer.classList.add('hidden');
        noBotSelected.classList.remove('hidden');
    }
    renderBots();
    renderFilters();
});

// Rendering Functions
function renderBots() {
    botsGrid.innerHTML = '';
    const filteredBots = currentFilter === 'all'
        ? bots
        : bots.filter(b => b.category === currentFilter);

    filteredBots.forEach(bot => {
        const div = document.createElement('div');
        div.className = `p-4 rounded-xl cursor-pointer transition-all border border-white/5 bot-card-anim ${selectedBotId === bot.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 hover:bg-white/10'}`;
        div.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="font-bold text-sm truncate">${bot.username}</span>
                <span class="w-2 h-2 rounded-full status-${bot.status}"></span>
            </div>
            <div class="text-[10px] text-white/40 font-medium truncate">${bot.host}:${bot.port}</div>
        `;
        div.onclick = () => selectBot(bot.id);
        botsGrid.appendChild(div);
    });
}

function renderFilters() {
    const categories = ['all', ...new Set(bots.map(b => b.category))];
    categoryFilters.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${currentFilter === cat ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`;
        btn.textContent = cat;
        btn.onclick = () => {
            currentFilter = cat;
            renderFilters();
            renderBots();
        };
        categoryFilters.appendChild(btn);
    });
}

function selectBot(botId) {
    selectedBotId = botId;
    const bot = bots.find(b => b.id === botId);

    noBotSelected.classList.add('hidden');
    chatContainer.classList.remove('hidden');

    chatWindow.innerHTML = '';
    bot.messages.forEach(msg => appendChatMessage(msg));

    updateChatHeader();
    updateChatControls();
    renderBots();
}

function updateChatHeader() {
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;

    activeBotName.textContent = bot.username;
    activeBotIp.textContent = `${bot.host}:${bot.port}`;
    botStatusIndicator.className = `w-3 h-3 rounded-full status-${bot.status}`;
}

function appendChatMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg flex items-start space-x-2';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-white/20 whitespace-nowrap text-[10px] pt-1 leading-none';
    timeSpan.textContent = msg.time;

    const userSpan = document.createElement('span');
    userSpan.className = 'text-indigo-400 font-bold whitespace-nowrap leading-tight';
    userSpan.textContent = `${msg.username}:`;

    const textSpan = document.createElement('span');
    textSpan.className = 'text-white/80 break-all leading-tight';
    textSpan.textContent = msg.message;

    div.appendChild(timeSpan);
    div.appendChild(userSpan);
    div.appendChild(textSpan);

    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateChatControls() {
    const bot = bots.find(b => b.id === selectedBotId);
    const isOnline = bot && bot.status === 'online';
    chatInput.disabled = !isOnline;
    sendChatBtn.disabled = !isOnline;
    chatInput.placeholder = isOnline ? "Transmit command..." : `Unit status: ${bot ? bot.status.toUpperCase() : 'UNKNOWN'}`;
}

removeBotBtn.onclick = () => {
    if (selectedBotId && confirm('Decommission unit?')) {
        socket.emit('remove-bot', selectedBotId);
    }
};

// Chat Input
sendChatBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage();
};

function sendMessage() {
    const message = chatInput.value.trim();
    if (message && selectedBotId) {
        socket.emit('send-chat', { botId: selectedBotId, message });
        chatInput.value = '';
    }
}

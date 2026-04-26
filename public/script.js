// Initialize Socket.io
let socket = io();

// DOM Elements
const botForm = document.getElementById('add-bot-form');
const botsGrid = document.getElementById('bots-grid');
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
const botCount = document.getElementById('bot-count');
const emptySidebar = document.getElementById('empty-sidebar');
const categoryFilters = document.getElementById('category-filters');

// Settings Elements
const settingsTrigger = document.getElementById('settings-trigger');
const settingsView = document.getElementById('settings-view');
const closeSettings = document.getElementById('close-settings');
const addNodeForm = document.getElementById('add-node-form');
const nodesList = document.getElementById('nodes-list');
const botNodeSelect = document.getElementById('bot-node');
const activeInstancesCount = document.getElementById('active-instances-count');
const registeredNodesCount = document.getElementById('registered-nodes-count');
const apiEndpointInput = document.getElementById('api-endpoint');
const saveEndpointBtn = document.getElementById('save-endpoint');

let bots = [];
let nodes = [];
let selectedBotId = null;
let currentCategory = 'ALL';

// Load saved endpoint
const savedEndpoint = localStorage.getItem('nexus-api-endpoint');
if (savedEndpoint) {
    apiEndpointInput.value = savedEndpoint;
    connectToSocket(savedEndpoint);
} else {
    setupSocketHandlers();
}

function connectToSocket(url) {
    if (socket) socket.disconnect();
    socket = io(url);
    setupSocketHandlers();
}

saveEndpointBtn.onclick = () => {
    const url = apiEndpointInput.value.trim();
    if (url) {
        localStorage.setItem('nexus-api-endpoint', url);
        connectToSocket(url);
        alert('REMOTE CONNECTION ESTABLISHED');
    } else {
        localStorage.removeItem('nexus-api-endpoint');
        location.reload();
    }
};

// Modal Controls
addBotTrigger.onclick = () => addBotModal.classList.remove('hidden');
closeModal.onclick = () => addBotModal.classList.add('hidden');
addBotModal.onclick = (e) => { if (e.target === addBotModal) addBotModal.classList.add('hidden'); };

// Settings Navigation
settingsTrigger.onclick = () => settingsView.classList.remove('hidden');
closeSettings.onclick = () => settingsView.classList.add('hidden');

// Form Submissions
botForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById('username').value.toUpperCase(),
        host: (document.getElementById('host').value || 'PLAY.BANANASMP.NET').toUpperCase(),
        port: parseInt(document.getElementById('port').value) || 25565,
        category: (document.getElementById('category').value || 'NEURAL_GRID').toUpperCase(),
        nodeId: document.getElementById('bot-node').value
    };
    socket.emit('add-bot', data);
    botForm.reset();
    addBotModal.classList.add('hidden');
});

addNodeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('node-name').value.toUpperCase(),
        ip: document.getElementById('node-ip').value
    };
    socket.emit('add-node', data);
    addNodeForm.reset();
});

// Socket Event Handlers Wrapper
function setupSocketHandlers() {
    socket.on('connect', () => {
        console.log('connected to nexus core');
    });

    socket.on('bots-list', (botList) => {
        bots = botList;
        updateCategoryFilters();
        updateSidebar();
        activeInstancesCount.textContent = bots.length;
    });

    socket.on('nodes-list', (nodeList) => {
        nodes = nodeList;
        updateNodesUI();
        registeredNodesCount.textContent = nodes.length;
    });

    socket.on('bot-added', (bot) => {
        bots.push(bot);
        updateCategoryFilters();
        updateSidebar();
        activeInstancesCount.textContent = bots.length;
    });

    socket.on('bot-status', (updatedBot) => {
        const index = bots.findIndex(b => b.id === updatedBot.id);
        if (index !== -1) {
            bots[index] = { ...bots[index], ...updatedBot };
            updateSidebar();
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
            chatContainer.classList.add('hidden', 'opacity-0');
            noBotSelected.classList.remove('hidden', 'opacity-0');
        }
        updateCategoryFilters();
        updateSidebar();
        activeInstancesCount.textContent = bots.length;
    });
}

// Rendering Functions
function updateNodesUI() {
    nodesList.innerHTML = '';
    botNodeSelect.innerHTML = '<option value="CORE_LOCAL">CORE_LOCAL (DEFAULT)</option>';

    nodes.forEach(node => {
        const div = document.createElement('div');
        div.className = 'bg-white/[0.01] border border-white/5 rounded-xl p-4 flex items-center justify-between';

        const info = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'text-[9px] font-black tracking-widest';
        name.textContent = node.name;
        const ip = document.createElement('div');
        ip.className = 'text-[7px] text-white/20 font-black';
        ip.textContent = node.ip;

        info.appendChild(name);
        info.appendChild(ip);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'text-white/10 hover:text-red-500 transition-colors';
        removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
        removeBtn.onclick = () => socket.emit('remove-node', node.id);

        div.appendChild(info);
        div.appendChild(removeBtn);
        nodesList.appendChild(div);

        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.name;
        botNodeSelect.appendChild(option);
    });
}

function updateCategoryFilters() {
    const categories = ['ALL', ...new Set(bots.map(b => b.category))];
    categoryFilters.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-btn text-[7px] font-black tracking-[0.2em] whitespace-nowrap ${currentCategory === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
            currentCategory = cat;
            updateCategoryFilters();
            updateSidebar();
        };
        categoryFilters.appendChild(btn);
    });
}

function updateSidebar() {
    botCount.textContent = bots.length;

    const filteredBots = currentCategory === 'ALL'
        ? bots
        : bots.filter(b => b.category === currentCategory);

    if (filteredBots.length === 0) {
        emptySidebar.classList.remove('hidden');
    } else {
        emptySidebar.classList.add('hidden');
    }

    const existingCards = botsGrid.querySelectorAll('.bot-card');
    existingCards.forEach(c => c.remove());

    filteredBots.forEach(bot => {
        const div = document.createElement('div');
        div.className = `bot-card p-5 rounded-xl cursor-pointer transition-all border ${selectedBotId === bot.id ? 'border-white/20 bg-white/[0.05]' : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'}`;

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-2';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-black text-[10px] truncate tracking-[0.1em] text-white';
        nameSpan.textContent = bot.username;

        const statusSpan = document.createElement('span');
        statusSpan.className = `w-1.5 h-1.5 rounded-full status-${bot.status}`;

        header.appendChild(nameSpan);
        header.appendChild(statusSpan);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'flex justify-between items-center';

        const ipSpan = document.createElement('span');
        ipSpan.className = 'text-[8px] text-white/20 font-black tracking-[0.2em] truncate';
        ipSpan.textContent = `${bot.host}:${bot.port}`;

        const nodeSpan = document.createElement('span');
        nodeSpan.className = 'text-[6px] text-white/10 font-black border border-white/5 px-1.5 py-0.5 rounded';
        const nodeName = nodes.find(n => n.id === bot.nodeId)?.name || 'CORE_LOCAL';
        nodeSpan.textContent = nodeName;

        infoDiv.appendChild(ipSpan);
        infoDiv.appendChild(nodeSpan);

        div.appendChild(header);
        div.appendChild(infoDiv);

        div.onclick = () => selectBot(bot.id);
        botsGrid.appendChild(div);
    });
}

function selectBot(botId) {
    selectedBotId = botId;
    const bot = bots.find(b => b.id === botId);

    noBotSelected.classList.add('opacity-0');
    setTimeout(() => {
        noBotSelected.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        setTimeout(() => chatContainer.classList.add('opacity-100'), 50);
    }, 500);

    chatWindow.innerHTML = '';
    bot.messages.forEach(msg => appendChatMessage(msg));

    updateChatHeader();
    updateChatControls();
    updateSidebar();
}

function updateChatHeader() {
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;

    activeBotName.textContent = bot.username;
    activeBotIp.textContent = `UPLINK: ${bot.host}:${bot.port}`;
    botStatusIndicator.className = `w-2 h-2 rounded-full status-${bot.status}`;
}

function appendChatMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg flex items-start space-x-6';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-white/10 whitespace-nowrap text-[9px] pt-1 font-black';
    timeSpan.textContent = msg.time;

    const userSpan = document.createElement('span');
    userSpan.className = 'text-white/30 font-black whitespace-nowrap text-[10px]';
    userSpan.textContent = `${msg.username}:`;

    const textSpan = document.createElement('span');
    textSpan.className = 'text-white/70 break-all';
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
    chatInput.placeholder = isOnline ? "AUTHORIZE COMMAND EXECUTION..." : `UNIT STATUS: ${bot ? bot.status.toUpperCase() : 'UNKNOWN'}`;
}

removeBotBtn.onclick = () => {
    if (selectedBotId && confirm('DECOMMISSION UNIT?')) {
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

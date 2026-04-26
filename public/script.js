const socket = io();

const botForm = document.getElementById('add-bot-form');
const botsGrid = document.getElementById('bots-grid');
const categoryFilters = document.getElementById('category-filters');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

let bots = [];
let selectedBotId = null;
let currentFilter = 'all';

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
        chatWindow.innerHTML = '<p class="placeholder">Select a bot to view chat</p>';
        updateChatControls();
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
        div.className = `bot-card glass ${selectedBotId === bot.id ? 'selected' : ''}`;
        div.innerHTML = `
            <div>
                <span class="bot-status status-${bot.status}"></span>
                <strong>${bot.username}</strong>
            </div>
            <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 5px;">
                ${bot.host}:${bot.port}<br>
                ${bot.category}
            </div>
            <button onclick="removeBot(event, '${bot.id}')" style="margin-top: 10px; background: rgba(239, 68, 68, 0.2); font-size: 0.7rem; padding: 4px;">Remove</button>
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
        btn.className = `filter-btn ${currentFilter === cat ? 'active' : ''}`;
        btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
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
    chatWindow.innerHTML = '';
    bot.messages.forEach(msg => appendChatMessage(msg));
    if (bot.messages.length === 0) {
        chatWindow.innerHTML = '<p class="placeholder">No messages yet</p>';
    }
    updateChatControls();
    renderBots();
}

function appendChatMessage(msg) {
    const placeholder = chatWindow.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
        <span class="time">[${msg.time}]</span>
        <span class="user">${msg.username}:</span>
        <span class="text">${msg.message}</span>
    `;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateChatControls() {
    const bot = bots.find(b => b.id === selectedBotId);
    const isOnline = bot && bot.status === 'online';
    chatInput.disabled = !isOnline;
    sendChatBtn.disabled = !isOnline;
    if (!isOnline) {
        chatInput.placeholder = bot ? `Bot is ${bot.status}...` : "Select a bot...";
    } else {
        chatInput.placeholder = "Type a message...";
    }
}

function removeBot(e, botId) {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this bot?')) {
        socket.emit('remove-bot', botId);
    }
}

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

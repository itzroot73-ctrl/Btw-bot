# NEXUS BOT - NEURAL GATEWAY

A professional-grade, high-performance Minecraft bot management dashboard featuring a sleek monochrome aesthetic, multi-process bot isolation, and distributed node management.

![Nexus Bot](public/screenshot.png) *(Note: Add your own screenshot here)*

## 🚀 CORE FEATURES
- **Isolated Bot Instances:** Each bot runs in its own process (`bot.js`) for maximum stability.
- **Node Management:** Add and manage multiple VPS nodes to track your distributed fleet.
- **Categorization:** Group units into custom neural grids and filter them in real-time.
- **Real-time Uplink:** Send and receive Minecraft chat messages through a secure Socket.io connection.
- **Neural Aesthetic:** High-contrast monochrome design with glassmorphism and grid-based visuals.

## 🛠️ INSTALLATION
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Access the UI: `http://localhost:3000`

## 🌐 DEPLOYMENT GUIDE

### 1. Full Stack (Recommended)
To run the panel AND the bots, you need a persistent Node.js environment:
- **Render / Railway / Fly.io:** Create a new "Web Service", link your repo, and use `npm start` as the start command.
- **VPS (Ubuntu/Debian):**
  - Install Node.js & PM2.
  - `npm install`
  - `pm2 start server.js --name nexus-bot`

### 2. Frontend Only (Netlify)
You can host the UI on Netlify, but it **requires a separate backend** to run the bots:
- **Publish Directory:** `public`
- **Build Command:** *(leave empty or `npm run build`)*
- **Configuration:** Go to the "Settings" tab in the UI and enter your remote "CORE API ENDPOINT" (e.g., your Render/VPS URL).

## ⚙️ CONFIGURATION
The panel defaults to:
- **IP:** `play.bananasmp.net`
- **Port:** `25565`
- **Category:** `NEURAL_GRID`

## 🛡️ SECURITY
- All bot-generated and user-generated text is sanitized using `.textContent` to prevent XSS.
- Multi-process architecture ensures process isolation.

## 📄 LICENSE
ISC

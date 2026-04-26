# Minecraft Bot Panel

A modern, glassmorphism-styled dashboard for managing multiple Minecraft bots using Mineflayer. Connect, categorize, and chat with your bots in real-time.

## Features

- **Glassmorphism UI:** Modern and sleek design with smooth animations.
- **Multi-Bot Support:** Add and manage multiple bots simultaneously.
- **Categorization:** Group bots into categories (e.g., Lobby, Survival) for easier management.
- **Real-time Chat:** View and send messages through individual bot instances.
- **Default Settings:** Pre-configured with default IP (`play.bananasmp.net`) and port (`25565`).
- **Responsive Design:** Works on both desktop and mobile devices.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```
   (Make sure you have `node server.js` set in your `package.json` or run it directly)

4. Open your browser and navigate to `http://localhost:3000`.

## Configuration

- **Bot Name:** The username for the Minecraft bot.
- **Server IP:** The Minecraft server address (default: `play.bananasmp.net`).
- **Port:** The server port (default: `25565`).
- **Category:** A label to organize your bots.

## Deployment

You can deploy this application to platforms like Heroku, Render, or any VPS that supports Node.js. Note that some hosting providers might block outgoing connections to Minecraft servers on certain ports.

## License

MIT

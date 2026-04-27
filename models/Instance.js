const mongoose = require('mongoose');

const instanceSchema = new mongoose.Schema({
    username: { type: String, required: true },
    host: { type: String, default: 'play.bananasmp.net' },
    port: { type: Number, default: 25565 },
    category: { type: String, default: 'NEURAL_GRID' },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Node' },
    status: { type: String, enum: ['deploying', 'running', 'stopped', 'error'], default: 'deploying' },
    settings: {
        // COMBAT
        killauraEnabled: { type: Boolean, default: false },
        killauraRange: { type: Number, default: 3.8 },
        killauraSpeed: { type: Number, default: 12 },
        triggerbotEnabled: { type: Boolean, default: false },
        aimassistEnabled: { type: Boolean, default: false },
        aimassistSpeed: { type: Number, default: 0.1 },

        // VISUAL
        espEnabled: { type: Boolean, default: false },
        espPlayers: { type: Boolean, default: true },
        espMobs: { type: Boolean, default: false },
        tracersEnabled: { type: Boolean, default: false },

        // UTILITY
        autoeatEnabled: { type: Boolean, default: true },
        autoarmorEnabled: { type: Boolean, default: true },
        antiafkEnabled: { type: Boolean, default: false },

        // MOVEMENT
        autosprintEnabled: { type: Boolean, default: true },
        sneakEnabled: { type: Boolean, default: false }
    },
    pm2Id: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Instance', instanceSchema);

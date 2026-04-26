const mongoose = require('mongoose');

const instanceSchema = new mongoose.Schema({
    username: { type: String, required: true },
    host: { type: String, default: 'play.bananasmp.net' },
    port: { type: Number, default: 25565 },
    category: { type: String, default: 'NEURAL_GRID' },
    nodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Node' },
    status: { type: String, enum: ['deploying', 'running', 'stopped', 'error'], default: 'deploying' },
    pm2Id: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Instance', instanceSchema);

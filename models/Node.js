const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    ip: { type: String, required: true },
    status: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'offline' },
    capacity: { type: Number, default: 10 },
    activeInstances: { type: Number, default: 0 },
    lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Node', nodeSchema);

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const RESOURCES = require('app.constants').RESOURCES;

const Favourite = new Schema({
    resourceId: { type: String, required: true, trim: true },
    application: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true, enum: RESOURCES },
    userId: { type: String, required: true, trim: true },
    createdAt: { type: Date, required: true, default: Date.now }
});

module.exports = mongoose.model('Favourite', Favourite);

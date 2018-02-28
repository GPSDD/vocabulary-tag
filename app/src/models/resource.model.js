const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const RESOURCES = require('app.constants').RESOURCES;

const Resource = new Schema({
    id: { type: String, required: true, trim: true },
    dataset: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, enum: RESOURCES },
    vocabularies: [{
        _id: false,
        id: { type: String, required: true, trim: true },
        tags: [{ type: String, required: true, trim: true }]
    }]
});

module.exports = mongoose.model('Resource', Resource);

const mongoose = require('mongoose');

const projectSchema = mongoose.Schema({
    name: {
        type: String,
        lowercase: true,
        required: true,
        trim: true,
        unique: [ true, 'Project name must be unique' ],
    },
    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    fileTree: {
        type: Object,
        default: {}
    },

})


module.exports = mongoose.model('Project', projectSchema);
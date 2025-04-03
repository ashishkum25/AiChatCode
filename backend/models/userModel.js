const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    email: {
        type: String,
        minlength: [6, "Username must be at least 3 characters long"],
        maxlength: [30, "Username must be at most 30 characters long"],
        trim: true,
        lowercase: true,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true,
        minlength: [5, "Password must be at least 8 characters long"],
        select: false
    }
});

module.exports = mongoose.model('User', userSchema);
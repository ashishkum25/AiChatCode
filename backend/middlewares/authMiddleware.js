const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel.js'); // Added this import
const redisClient = require('../services/redisService.js');

module.exports.authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized User' });
        }

        // CHANGE HERE: Check the actual token value in Redis, not the string 'token'
        const isBlackListed = await redisClient.get(token); 
        if (isBlackListed) {
            res.cookie('token', '');
            return res.status(401).json({ message: 'Unauthorized User' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // CHANGE HERE: Get the full user object from database
            const user = await userModel.findOne({ email: decoded.email });
            
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }
            
            // CHANGE HERE: Set the actual user object, not just decoded token
            req.user = user;
            
            // CHANGE HERE: Store token in request for logout functionality
            req.token = token;
            
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Unauthorized User' });
        }
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized User' });
    }
};
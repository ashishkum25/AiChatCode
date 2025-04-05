const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel.js');
const redisClient = require('../services/redisService.js');

module.exports.authUser = async (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Check if token is blacklisted in Redis
        const isBlackListed = await redisClient.get(token); 
        if (isBlackListed) {
            // Clear cookie if present
            if (req.cookies.token) {
                res.clearCookie('token');
            }
            return res.status(401).json({ message: 'Token expired, please login again' });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get the full user object from database
            const user = await userModel.findOne({ email: decoded.email });
            
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }
            
            // Store user and token in request for future use
            req.user = user;
            req.token = token;
            
            next();
        } catch (error) {
            // Handle specific JWT errors
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired, please login again' });
            } else if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token' });
            }
            
            return res.status(401).json({ message: 'Authentication failed' });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
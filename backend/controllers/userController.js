const userModel = require('../models/userModel.js');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const redisClient = require('../services/redisService.js');

module.exports.registerUser =  async (req, res) => {
    const errors = validationResult(req); 
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array(), message: "Invalid data"});
    }

    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await userModel.create({
        email: email, 
        password: hashedPassword
    });
    
    let token = jwt.sign({email: createdUser.email}, process.env.JWT_SECRET, {expiresIn: '24h'});

    delete createdUser._doc.password; //Frontend pe password nhi bhejne ke liye yeh karna parta hai

    res.status(201).json({
        message: "User Created Successfully!",
        success: true,
        token: token,
        user: createdUser
    });

};

module.exports.loginUser = async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array(), message: "Invalid data"});
    }

    const { email, password } = req.body;

    const user = await userModel.findOne({ email: email }).select('+password');
    if(!user){
        return res.status(400).json({message: "Username or password is incorrect"});
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid){
        return res.status(400).json({message: "Username or password is incorrect"});
    }

    let token = jwt.sign({email: user.email}, process.env.JWT_SECRET, {expiresIn: '24h'});

    delete user._doc.password; //Frontend pe password nhi bhejne ke liye yeh karna parta hai

    res.status(201).json({
        message: "Logged In Successfully!",
        success: true,
        token: token,
        user: user
    });
};

module.exports.profile = async (req, res) => {
    console.log(req.user);
    res.status(200).json({
        user: req.user
    });
};

module.exports.logoutUser = async (req, res) => {
    try {
        // CHANGE HERE: Use the token that was stored in the request by middleware
        const token = req.token;
        
        if (!token) {
            return res.status(400).json({ message: "No token found to logout" });
        }
        
        // CHANGE HERE: Use the actual token as the key in Redis
        await redisClient.set(token, 'logout', 'EX', 60 * 60 * 24);
        
        // Clear cookie if using cookies
        if (req.cookies.token) {
            res.clearCookie('token');
        }
        
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.log(err);
        res.status(400).send(err.message);
    }
};

module.exports.getAllUsersController = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const allUsers = await userModel.find({ _id: { $ne: loggedInUser._id  } });//$ne means not equal to the loggedIn User

        return res.status(200).json({ users: allUsers });

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
};
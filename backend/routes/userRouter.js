const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware.js');

router.post('/register',
    body('email').trim().isEmail().isLength({ min: 14 }).withMessage('Email must be at least 14 characters'),
    body('password').trim().isLength({ min: 5 }).withMessage('Password must be at least 5 characters'),
    userController.registerUser
);

router.post('/login',
    body('email').trim().isEmail().isLength({ min: 14 }).withMessage('Email must be at least 14 characters'),
    body('password').trim().isLength({min: 5}),
    userController.loginUser
);

router.get('/profile', authMiddleware.authUser, userController.profile);

router.get('/logout', authMiddleware.authUser, userController.logoutUser);

module.exports = router;
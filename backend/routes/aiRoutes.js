const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController.js');

router.get('/get-result', aiController.getResult);


module.exports = router;
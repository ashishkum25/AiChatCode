const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const projectController = require('../controllers/projectController.js');
const authMiddleware = require('../middlewares/authMiddleware.js');


router.post('/create',
    authMiddleware.authUser,
    body('name').isString().withMessage('Name is required'),
    projectController.createProject
);

router.get('/all',
    authMiddleware.authUser,
    projectController.getAllProject
);

router.put('/add-user',  //router.put() is basically used to add/update anything
    authMiddleware.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('users').isArray({ min: 1 }).withMessage('Users must be an array of strings').bail()
        .custom((users) => users.every(user => typeof user === 'string')).withMessage('Each user must be a string'),
    projectController.addUserToProject
);

router.get('/get-project/:projectId',
    authMiddleware.authUser,
    projectController.getProjectById
);

router.put('/update-file-tree',
    authMiddleware.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('fileTree').isObject().withMessage('File tree is required'),
    projectController.updateFileTree
)


module.exports = router;
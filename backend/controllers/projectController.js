const projectModel = require('../models/projectModel.js');
const projectService = require('../services/projectService.js');
const userModel = require('../models/userModel.js');
const { validationResult } = require('express-validator');

module.exports.createProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { name } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const userId = loggedInUser._id;

        const newProject = await projectService.createProject({ name, userId });

        res.status(201).json(newProject);

    } catch (err) {
        console.log(err);
        res.status(400).send(err.message);
    }
};

module.exports.getAllProject = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const allUserProjects = await projectService.getAllProjectByUserId({ userId: loggedInUser._id });

        return res.status(200).json({ projects: allUserProjects });

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
};

module.exports.addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, users } = req.body
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const project = await projectService.addUsersToProject({ projectId, users, userId: loggedInUser._id });

        return res.status(200).json({ project });

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
};

module.exports.getProjectById = async (req, res) => {
    const { projectId } = req.params;
    try {
        const project = await projectService.getProjectById({ projectId });
        return res.status(200).json({ project });
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
};

module.exports.updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, fileTree } = req.body;
        const project = await projectService.updateFileTree({ projectId, fileTree });

        return res.status(200).json({ project });

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }

};
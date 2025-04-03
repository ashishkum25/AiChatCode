const express = require('express');
const app = express();

const connectDB = require('./config/db.js');
connectDB();

const cors = require('cors');
app.use(cors());

const userRouter = require('./routes/userRouter.js'); 
const projectRouter = require('./routes/projectRouter.js');

const cookieParser = require('cookie-parser');
app.use(cookieParser());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/users',userRouter);
app.use('/projects',projectRouter);

module.exports = app;

const express = require('express');
const app = express();
const connectDB = require('./config/db.js');
connectDB();

const userRouter = require('./routes/userRouter.js'); 

const cookieParser = require('cookie-parser');
app.use(cookieParser());




app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/users',userRouter);

module.exports = app;

const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const app = require('./app');
const SocketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const projectModel = require('./models/projectModel.js');
const aiService = require('./services/aiService.js');


const server = http.createServer(app);
const io = SocketIO(server, {
    cors: {
        origin: '*'
    }
});

//Authentication Middleware so that only the authenticated user can connect to the socket
io.use(async (socket, next) => {

  try {

      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[ 1 ];
      const projectId = socket.handshake.query.projectId;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
          return next(new Error('Invalid projectId'));
      }

      socket.project = await projectModel.findById(projectId);

      if (!token) {
          return next(new Error('Authentication error'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded) {
          return next(new Error('Authentication error'))
      }

      socket.user = decoded;
      next();
  } catch (error) {
      next(error)
  }
});

io.on('connection', socket => {
  socket.roomId = socket.project._id.toString()

  console.log('a user connected');

  socket.join(socket.roomId);

  socket.on('project-message', async data => {

      const message = data.message;

      const aiIsPresentInMessage = message.includes('@ai');
      socket.broadcast.to(socket.roomId).emit('project-message', data)

      if (aiIsPresentInMessage) {

          const prompt = message.replace('@ai', '');

          // Use the generateResult method from aiService module
          const result = await aiService.generateResult(prompt);

          io.to(socket.roomId).emit('project-message', {
              message: result,
              sender: {
                  _id: 'ai',
                  email: 'AI'
              }
          })
          return
      }
  })

  socket.on('disconnect', () => {
      console.log('user disconnected');
      socket.leave(socket.roomId)
  });
});


server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
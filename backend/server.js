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

// Authentication Middleware for socket connections
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }

        socket.project = await projectModel.findById(projectId);
        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return next(new Error('Authentication error'));
        }

        socket.user = decoded;
        next();
    } catch (error) {
        next(error);
    }
});

// Store connected clients to prevent duplicates
const connectedClients = new Map();

io.on('connection', socket => {
    const roomId = socket.project._id.toString();
    const userId = socket.user.email;
    const clientId = `${userId}-${roomId}`;
    
    // Check if this client (user+project combination) is already connected
    if (connectedClients.has(clientId)) {
        console.log(`Client ${clientId} already connected, disconnecting old socket`);
        const oldSocket = connectedClients.get(clientId);
        oldSocket.disconnect();
    }
    
    // Store this socket connection
    connectedClients.set(clientId, socket);
    socket.roomId = roomId;

    console.log(`User ${userId} connected to project ${roomId}`);

    socket.join(roomId);

    socket.on('project-message', async data => {
        const message = data.message;
        const aiIsPresentInMessage = message.includes('@ai');
        
        // Broadcast message to other clients in the room
        socket.broadcast.to(roomId).emit('project-message', data);

        if (aiIsPresentInMessage) {
            const prompt = message.replace('@ai', '');

            try {
                // Use the generateResult method from aiService module
                const result = await aiService.generateResult(prompt);

                io.to(roomId).emit('project-message', {
                    message: result,
                    sender: {
                        _id: 'ai',
                        email: 'AI'
                    }
                });
            } catch (error) {
                console.error('Error generating AI response:', error);
                
                // Send error message back to the room
                io.to(roomId).emit('project-message', {
                    message: JSON.stringify({
                        text: `Sorry, I encountered an error processing your request: ${error.message}`
                    }),
                    sender: {
                        _id: 'ai',
                        email: 'AI'
                    }
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${userId} disconnected from project ${roomId}`);
        socket.leave(roomId);
        connectedClients.delete(clientId);
    });
});

// Handle uncaught promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
    // Don't crash the server, just log the error
});

// Start the server
server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
import socket from 'socket.io-client';

// Single socket instance to prevent multiple connections
let socketInstance = null;
let currentProjectId = null;

// Making connection Function
export const initializeSocket = (projectId) => {
    // Don't reconnect if already connected to this project
    if (socketInstance && currentProjectId === projectId) {
        console.log(`Already connected to project ${projectId}`);
        return socketInstance;
    }
    
    // If socket already exists but connecting to different project,
    // disconnect it before creating a new one
    if (socketInstance) {
        console.log(`Disconnecting from previous project ${currentProjectId}`);
        socketInstance.disconnect();
        socketInstance = null;
    }
    
    // Create new socket connection
    console.log(`Connecting to project ${projectId}`);
    currentProjectId = projectId;
    
    socketInstance = socket(import.meta.env.VITE_API_URL, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        // Prevent multiple connections from the same client
        transports: ['websocket']
    });
    
    // Handle connection events
    socketInstance.on('connect', () => {
        console.log(`Socket connected to project ${projectId}`);
    });
    
    socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });
    
    socketInstance.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        
        // Only try to reconnect if we haven't manually disconnected
        if (reason === 'io server disconnect' && currentProjectId === projectId) {
            socketInstance.connect();
        }
    });
    
    return socketInstance;
};

// Receiving Message Function
export const receiveMessage = (eventName, cb) => {
    if (!socketInstance) {
        console.error('Socket not initialized');
        return () => {}; // Return a cleanup function
    }
    
    // Register the event listener
    socketInstance.on(eventName, cb);
    
    // Return a function to remove the listener (useful for cleanup in useEffect)
    return () => {
        socketInstance.off(eventName, cb);
    };
};

// Sending Message Function
export const sendMessage = (eventName, data) => {
    if (!socketInstance) {
        console.error('Socket not initialized');
        return false;
    }
    socketInstance.emit(eventName, data);
    return true;
};

// Cleanup function to use when component unmounts
export const disconnectSocket = () => {
    if (socketInstance) {
        console.log(`Manually disconnecting from project ${currentProjectId}`);
        socketInstance.disconnect();
        socketInstance = null;
        currentProjectId = null;
    }
};
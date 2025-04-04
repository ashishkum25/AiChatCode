import socket from 'socket.io-client';

let socketInstance = null;

//Making connection Function
export const initializeSocket = (projectId) => {
    socketInstance = socket(import.meta.env.VITE_API_URL, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        }
    });
    return socketInstance;
};

//Receiving Message Function
export const receiveMessage = (eventName, cb) => {
    socketInstance.on(eventName, cb);
};

//Sending Message Function
export const sendMessage = (eventName, data) => {
    socketInstance.emit(eventName, data);
};
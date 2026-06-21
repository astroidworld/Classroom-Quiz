import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { env } from './config/env.js';
import { registerQuizHandlers } from './sockets/quizSocket.js';

const server = http.createServer(app);


// Initialize Socket.IO server
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Register quiz socket event handlers
registerQuizHandlers(io as any);

// Start listening on port
server.listen(env.PORT, () => {
  console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

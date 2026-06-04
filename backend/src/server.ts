import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { env, connectDatabase, ensureUploadDirectories } from './config';
import { getAllowedOrigins } from './config/cors';
import app from './app';
import { notificationService } from './services/notification/notificationService';
import { setWorkflowIoEmitter } from './services/workflow/workflowService';
import { resetOpenAIClient } from './services/ai/openaiClient';
import { startWorkers } from './workers';

async function bootstrap() {
  ensureUploadDirectories();
  resetOpenAIClient();
  await connectDatabase();
  await startWorkers();

  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  notificationService.setSocketServer(io);

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (userId) socket.join(`user:${userId}`);

    socket.on('join:tender', (tenderId: string) => {
      socket.join(`tender:${tenderId}`);
    });
  });

  setWorkflowIoEmitter((tenderId, data) => {
    io.to(`tender:${tenderId}`).emit('tender:update', data);
  });

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

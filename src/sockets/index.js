import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient, connectRedis } from '../config/redis.js';
import { socketAuthMiddleware } from './authMiddleware.js';
import { markOnline, markSocketClosed } from './presence.js';
import { registerTypingHandlers } from './handlers/typingHandlers.js';

// NOTE: There is no message:send / message:delivered / message:read
// handler here on purpose. Your REST controllers (chatMessageController)
// already own message writes — block checks, membership checks, and
// unreadCount updates all happen there — and they emit the resulting
// events themselves via req.app.get('io'). Sockets here only handle
// what REST doesn't: room membership for broadcast delivery, typing,
// and presence.

let io;

export async function initSocketServer(httpServer) {
  await connectRedis();

  io = new Server(httpServer, {
    cors: { origin: '*' }, // tighten to your app's origin(s) in production
    adapter: createAdapter(pubClient, subClient),
  });

  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    console.log(`🔌 Socket connected: user=${socket.userId} socket=${socket.id}`);

    // Auto-join a per-user room so REST controllers can target this user
    // directly: io.to(`user:${userId}`).emit('conversation:updated', ...)
    socket.join(`user:${socket.userId}`);

    await markOnline(socket.userId, socket.id);
    io.emit('presence:changed', { userId: socket.userId, isOnline: true });

    // Client joins a room to receive its message:new / message:statusUpdate
    // / typing:update broadcasts. roomId must match ChatRoom.id.
    socket.on('conversation:join', (roomId) => {
      socket.join(`room:${roomId}`);
    });

    socket.on('conversation:leave', (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    registerTypingHandlers(io, socket);

    socket.on('disconnect', async () => {
      const { wentOffline, lastSeenAt } = await markSocketClosed(socket.userId, socket.id);
      if (wentOffline) {
        io.emit('presence:changed', {
          userId: socket.userId,
          isOnline: false,
          lastSeenAt,
        });
      }
      console.log(`🔌 Socket disconnected: user=${socket.userId} socket=${socket.id}`);
    });
  });

  return io;
}

// Fallback getter for any non-request code path (cron jobs, workers) that
// needs to emit — request handlers should use req.app.get('io') instead.
export function getIO() {
  if (!io) throw new Error('Socket.io not initialized — call initSocketServer first');
  return io;
}
import { redisClient } from '../../config/redis.js';
import prisma from '../../lib/prisma.js'; // was missing — conversation:leave needs it
import { requireParticipant } from '../../services/chatMessageService.js';

export default function registerViewingHandlers(io, socket) {
  const userId = socket.user.id;

  socket.on('conversation:open', async ({ roomId }, ack) => {
    try {
      const id = parseInt(roomId);
      await requireParticipant(id, userId);

      socket.join(`room:${id}`);
      await redisClient.sAdd(`viewing:${id}`, String(userId));
      ack?.({ status: 'ok' });
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  socket.on('conversation:close', async ({ roomId }) => {
    const id = parseInt(roomId);
    socket.leave(`room:${id}`);
  // REPLACE WITH:
    await redisClient.sRem(`viewing:${id}`, String(userId)).catch((err) =>
    console.error('viewing: sRem failed', err)
    );
  });

  socket.on('conversation:leave', async ({ roomId }, ack) => {
    try {
      const id = parseInt(roomId);
      await requireParticipant(id, userId);
      await prisma.chatRoomMember.delete({
        where: {
          roomId_userId: {
            roomId: id,
            userId,
          },
        },
      });

      socket.leave(`room:${id}`);

      await redisClient.sRem(`viewing:${id}`, String(userId)); // sRem, not srem

      socket.to(`room:${id}`).emit('conversation:left', { roomId: id, userId });

      socket.emit('conversation:removed', { roomId: id });

      ack?.({ status: 'ok' });
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  socket.on('disconnecting', async () => {
    for (const room of socket.rooms) {
      if (!room.startsWith('room:')) continue;
      const roomId = room.slice('room:'.length);
      await redisClient.sRem(`viewing:${roomId}`, String(userId)).catch((err) =>
      console.error('viewing: cleanup on disconnect failed', err)
    );
    }
  });
}

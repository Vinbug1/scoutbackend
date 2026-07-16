import { redisClient } from '../../config/redis.js';
import { requireParticipant } from '../../services/chatMessageService.js';

// Tracks "is this user CURRENTLY looking at this specific chat screen."
// Two consumers of this data, both outside this file:
//   1. The push-notification worker (spec §12) skips sending a push if
//      the recipient is online AND currently viewing the room the
//      message landed in.
//   2. Socket room membership itself — a socket only joins `room:{id}`
//      when the corresponding chat screen is open (see conversation:open
//      below), NOT for every room the user is a member of. That's
//      deliberate: message:new broadcasts only need to reach whoever has
//      that specific screen open right now. Everyone else still gets the
//      lighter-weight `conversation:updated` event on their personal
//      `user:{id}` channel (see messageHandlers.js), which is enough to
//      update an inbox row/badge without needing full room membership.
export default function registerViewingHandlers(io, socket) {
  const userId = socket.user.id;

  socket.on('conversation:open', async ({ roomId }, ack) => {
    try {
      const id = parseInt(roomId);
      // rejects non-participants with a clean ack error (spec §13.1
      // checklist item — "conversation:open rejects non-participants
      // with a clean ack error").
      await requireParticipant(id, userId);

      socket.join(`room:${id}`);
      await redisClient.sadd(`viewing:${id}`, userId);
      ack?.({ status: 'ok' });
    } catch (err) {
      ack?.({ status: 'error', error: err.message });
    }
  });

  socket.on('conversation:close', async ({ roomId }) => {
    const id = parseInt(roomId);
    socket.leave(`room:${id}`);
    await redisClient.srem(`viewing:${id}`, userId).catch((err) =>
      console.error('viewing: srem failed', err)
    );
  });

  // Safety net — if the socket disconnects (app backgrounded, network
  // drop, tab closed) without ever sending conversation:close, this
  // makes sure the viewing-set doesn't permanently retain a stale entry
  // for a user who isn't actually looking at anything anymore. Without
  // this, the push-notification worker would wrongly keep skipping
  // pushes for a room the user closed by just killing the app.
  socket.on('disconnecting', async () => {
    for (const room of socket.rooms) {
      if (!room.startsWith('room:')) continue;
      const roomId = room.slice('room:'.length);
      await redisClient.srem(`viewing:${roomId}`, userId).catch((err) =>
        console.error('viewing: cleanup on disconnect failed', err)
      );
    }
  });
}

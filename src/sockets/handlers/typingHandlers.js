import { requireParticipant } from '../../services/chatMessageService';

// Typing indicators are low-stakes: if the membership check fails (bad
// roomId, user isn't actually in the room), we just silently drop the
// event rather than surfacing an error — there's no ack for the client
// to receive it on anyway, and a rejected typing:start isn't worth
// alarming the UI over.
export default function registerTypingHandlers(io, socket) {
  const userId = socket.user.id;

  socket.on('typing:start', async ({ roomId }) => {
    try {
      const id = parseInt(roomId);
      await requireParticipant(id, userId);
      socket.to(`room:${id}`).emit('typing:update', { roomId: id, userId, isTyping: true });
    } catch {
      // not a member, or bad roomId — drop silently
    }
  });

  socket.on('typing:stop', async ({ roomId }) => {
    try {
      const id = parseInt(roomId);
      await requireParticipant(id, userId);
      socket.to(`room:${id}`).emit('typing:update', { roomId: id, userId, isTyping: false });
    } catch {
      // drop silently
    }
  });
}













// import { requireParticipant } from '../services/chatMessageService.js';

// // Typing indicators are low-stakes: if the membership check fails (bad
// // roomId, user isn't actually in the room), we just silently drop the
// // event rather than surfacing an error — there's no ack for the client
// // to receive it on anyway, and a rejected typing:start isn't worth
// // alarming the UI over.
// export default function registerTypingHandlers(io, socket) {
//   const userId = socket.user.id;

//   socket.on('typing:start', async ({ roomId }) => {
//     try {
//       const id = parseInt(roomId);
//       await requireParticipant(id, userId);
//       socket.to(`room:${id}`).emit('typing:update', { roomId: id, userId, isTyping: true });
//     } catch {
//       // not a member, or bad roomId — drop silently
//     }
//   });

//   socket.on('typing:stop', async ({ roomId }) => {
//     try {
//       const id = parseInt(roomId);
//       await requireParticipant(id, userId);
//       socket.to(`room:${id}`).emit('typing:update', { roomId: id, userId, isTyping: false });
//     } catch {
//       // drop silently
//     }
//   });
// }
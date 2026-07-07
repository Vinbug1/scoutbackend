// Typing state is ephemeral and high-frequency — no DB writes, just
// room broadcasts. Redis adapter handles fan-out across server instances.

export function registerTypingHandlers(io, socket) {
    socket.on('typing:start', ({ roomId }) => {
      socket.to(`room:${roomId}`).emit('typing:update', {
        roomId,
        userId: socket.userId,
        isTyping: true,
      });
    });
  
    socket.on('typing:stop', ({ roomId }) => {
      socket.to(`room:${roomId}`).emit('typing:update', {
        roomId,
        userId: socket.userId,
        isTyping: false,
      });
    });
  }
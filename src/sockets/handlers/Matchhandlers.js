// Handles clients joining/leaving a live match's tracking room, so
// startTrackingMatch() in liveTracker.js can emit 'player-positions'
// to everyone watching that specific match via io.to(`match-${matchId}`).
//
// Follows the same registration pattern as messageHandlers.js,
// presenceHandlers.js, etc. — called once per connected socket from
// initSocketServer().

export default function registerMatchHandlers(io, socket) {
    socket.on('join-match', (matchId) => {
      if (!matchId) return;
  
      socket.join(`match-${matchId}`);
      console.log(`👤 User ${socket.user.id} joined match-${matchId}`);
    });
  
    socket.on('leave-match', (matchId) => {
      if (!matchId) return;
  
      socket.leave(`match-${matchId}`);
      console.log(`👤 User ${socket.user.id} left match-${matchId}`);
    });
  }
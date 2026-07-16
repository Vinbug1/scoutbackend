import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis.js';
import authMiddleware from './authMiddleware.js';
import registerMessageHandlers from './messageHandlers.js';
import registerPresenceHandlers from './presenceHandlers.js';
import registerTypingHandlers from './typingHandlers.js';
import registerViewingHandlers from './viewingHandlers.js';

// Call this once, right after you create your HTTP server, and AFTER
// Redis has already been connected via connectRedis() in app.js — e.g.:
//
//   const httpServer = http.createServer(app);
//   await connectRedis();
//   const io = initSocketServer(httpServer, allowedOrigins);
//   app.set('io', io);
//   httpServer.listen(PORT);
//
// Note it's httpServer.listen(...), not app.listen(...) — Socket.io
// needs the raw http.Server instance to attach to.
//
// This function is now synchronous (no internal Redis connect) —
// pubClient/subClient are expected to already be connected by the time
// this runs.
export function initSocketServer(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins },
  });

  // pubClient/subClient come pre-built from config/redis.js specifically
  // for the adapter — no .duplicate() needed here.
  //
  // No sticky sessions needed once this adapter is in place (spec
  // §13.1) — it's what lets multiple server instances behind a load
  // balancer share room membership and presence state correctly.
  io.adapter(createAdapter(pubClient, subClient));

  io.use(authMiddleware);

  io.on('connection', (socket) => {
    // Every socket joins its own personal room on connect — this is
    // where conversation:new, conversation:updated, and inbox-level
    // events land, independent of which specific chat screen (if any)
    // is currently open. See viewingHandlers.js for the distinction
    // between this and `room:{roomId}`.
    socket.join(`user:${socket.user.id}`);

    registerMessageHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerViewingHandlers(io, socket);
  });

  return io;
}



















// import { Server } from 'socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { pubClient, subClient, connectRedis } from '../config/redis.js';
// import authMiddleware from './authMiddleware.js';
// import registerMessageHandlers from './messageHandlers.js';
// import registerPresenceHandlers from './presenceHandlers.js';
// import registerTypingHandlers from './typingHandlers.js';
// import registerViewingHandlers from './viewingHandlers.js';

// export async function initSocketServer(httpServer, allowedOrigins) {
//   await connectRedis(); // must be connected before the adapter attaches

//   const io = new Server(httpServer, {
//     cors: { origin: allowedOrigins },
//   });

//   io.adapter(createAdapter(pubClient, subClient));

//   io.use(authMiddleware);

//   io.on('connection', (socket) => {
//     socket.join(`user:${socket.user.id}`);

//     registerMessageHandlers(io, socket);
//     registerPresenceHandlers(io, socket);
//     registerTypingHandlers(io, socket);
//     registerViewingHandlers(io, socket);
//   });

//   return io;
// }



















// import { Server } from 'socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { pubClient, subClient, connectRedis } from '../config/redis.js';
// import authMiddleware from './authMiddleware.js';
// import registerMessageHandlers from './messageHandlers.js';
// import registerPresenceHandlers from './presenceHandlers.js';
// import registerTypingHandlers from './typingHandlers.js';
// import registerViewingHandlers from './viewingHandlers.js';

// // Call this once, right after you create your HTTP server — e.g.:
// //
// //   import http from 'http';
// //   import app from './app.js';
// //   import { initSocketServer } from './socket/index.js';
// //
// //   const httpServer = http.createServer(app);
// //   const io = initSocketServer(httpServer, allowedOrigins);
// //
// //   // IMPORTANT — every controller you already have
// //   // (chatMessageController.js, chatRoomController.js) calls
// //   // `req.app.get('io')` to broadcast after a REST-driven action. That
// //   // ONLY works if you do this:
// //   app.set('io', io);
// //
// //   httpServer.listen(PORT);
// //
// // Note it's httpServer.listen(...), not app.listen(...) — Socket.io
// // needs the raw http.Server instance to attach to, and app.listen()
// // under the hood just creates one for you anyway and throws it away.
// export function initSocketServer(httpServer, allowedOrigins) {
//   const io = new Server(httpServer, {
//     cors: { origin: allowedOrigins },
//   });

//   // ⚠️ ASSUMPTION — redisClient here is assumed to be an ioredis
//   // instance (`.duplicate()` is ioredis-specific; node-redis's API
//   // differs — you'd construct two separate clients with createClient()
//   // instead). Confirm against whatever `../lib/redis.js` actually
//   // exports; your memory notes a Redis layer already exists in this
//   // codebase, so this is very likely already the right shape, but worth
//   // a quick check before wiring this in.
//   //
//   // No sticky sessions needed once this adapter is in place (spec
//   // §13.1) — it's what lets multiple server instances behind a load
//   // balancer share room membership and presence state correctly.
//   const pubClient = redisClient.duplicate();
//   const subClient = redisClient.duplicate();
//   io.adapter(createAdapter(pubClient, subClient));

//   io.use(authMiddleware);

//   io.on('connection', (socket) => {
//     // Every socket joins its own personal room on connect — this is
//     // where conversation:new, conversation:updated, and inbox-level
//     // events land, independent of which specific chat screen (if any)
//     // is currently open. See viewingHandlers.js for the distinction
//     // between this and `room:{roomId}`.
//     socket.join(`user:${socket.user.id}`);

//     registerMessageHandlers(io, socket);
//     registerPresenceHandlers(io, socket);
//     registerTypingHandlers(io, socket);
//     registerViewingHandlers(io, socket);
//   });

//   return io;
// }
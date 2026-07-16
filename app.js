// Import dependencies using ESM
import dotenv from 'dotenv';
dotenv.config(); // ✅ MUST be first before everything else

import http from 'http';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import swaggerUi from 'swagger-ui-express';

// Import routes
import userRouters from './src/routes/userRouters.js';
import challengeParticipantRouters from './src/routes/challengeParticipantRouters.js';
import challengeRouters from './src/routes/challengeRouters.js';
import chatMessageRouters from './src/routes/chatMessageRouters.js';
import chatRoomRouters from './src/routes/chatRoomRouters.js';
import commentRouters from './src/routes/commentRouters.js';
import followerRouters from './src/routes/followerRouters.js';
import paymentRouters from './src/routes/paymentRouters.js';
import postRouters from './src/routes/postRouters.js';
import profileRouters from './src/routes/profileRouters.js';
import scoutProfileRouters from './src/routes/scoutProfileRouters.js';
import rankingRouters from './src/routes/rankingRouters.js';
import ratingRouters from './src/routes/ratingRouters.js';
import scoutReportRouters from './src/routes/scoutReportRouters.js';
import videoRouters from './src/routes/videoRouters.js';
import videoViewRouters from './src/routes/videoViewRouters.js';
import swaggerSpec from './src/config/swagger.js';
import videoCategory from './src/routes/videoCategoryRoutes.js';
import reelRouters from './src/routes/reelRoutes.js';

import { initSocketServer } from './src/sockets/index.js';
import { connectRedis } from './src/config/redis.js';

const app = express();
const prisma = new PrismaClient();
const api = '/api';
const PORT = process.env.PORT || 4000;

// ─── Allowed Origins (shared between REST CORS and Socket.io CORS) ────
// TODO: replace/extend with your actual production + staging + mobile origins.
const allowedOrigins = [
  'https://thescouterpro.com',
  'https://www.thescouterpro.com',
];

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: allowedOrigins })); // CHANGED — was cors() with no options (allowed every origin)

// ─── Request Logger ─────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Swagger Docs ─────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Health Check Routes ──────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Scout Backend API is running!',
    status: 'OK',
    environment: process.env.NODE_ENV,
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
  });
});

// ─── API Routes ───────────────────────────────────────────────
app.use(`${api}/users`, userRouters);
app.use(`${api}/challengeParticipants`, challengeParticipantRouters);
app.use(`${api}/challenges`, challengeRouters);
app.use(`${api}/chatMessages`, chatMessageRouters);
app.use(`${api}/chatRooms`, chatRoomRouters);
app.use(`${api}/comments`, commentRouters);
app.use(`${api}/followers`, followerRouters);
app.use(`${api}/payments`, paymentRouters);
app.use(`${api}/posts`, postRouters);
app.use(`${api}/profiles`, profileRouters);
app.use(`${api}/scoutProfiles`, scoutProfileRouters);
app.use(`${api}/rankings`, rankingRouters);
app.use(`${api}/ratings`, ratingRouters);
app.use(`${api}/scoutReports`, scoutReportRouters);
app.use(`${api}/videos`, videoRouters);
app.use(`${api}/videoViews`, videoViewRouters);
app.use(`${api}/videoCategory`, videoCategory);
app.use(`${api}/reels`, reelRouters);

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`❌ Error: ${err.message}`);
  console.error(err.stack);
  const status = err.statusCode || err.status || 500; // CHANGED — also check .statusCode (what your services/controllers actually throw)
  res.status(status).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
  });
});

// ─── Start Server ─────────────────────────────────────────────
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to the PostgreSQL database');

    // NEW — Redis connects once, here, before anything that depends on
    // it (Socket.io adapter, presence/viewing handlers) is wired up.
    await connectRedis();
    console.log('✅ Connected to Redis');

    // Wrap express app in a raw http server so Socket.io can share the port
    const httpServer = http.createServer(app);

    // Attach Socket.io — Redis is already connected by this point, so
    // initSocketServer no longer needs to connect it itself.
    const io = initSocketServer(httpServer, allowedOrigins);
    app.set('io', io); // makes req.app.get('io') work inside your controllers
    console.log('✅ Socket.io server attached with Redis adapter');

    const server = httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📚 API Docs: https://www.thescouterpro.com/api-docs`);
      console.log(`🏥 Health Check: https://www.thescouterpro.com/health`);
    });

    server.timeout = 300000;
    server.keepAliveTimeout = 310000;
    server.headersTimeout = 320000;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// ─── Graceful Shutdown ────────────────────────────────────────
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('🛑 Server shut down gracefully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('🛑 Server shut down gracefully');
  process.exit(0);
});




















// // Import dependencies using ESM
// import dotenv from 'dotenv';
// dotenv.config(); // ✅ MUST be first before everything else

// import http from 'http';
// import express from 'express';
// import cors from 'cors';
// import { PrismaClient } from '@prisma/client';
// import swaggerUi from 'swagger-ui-express';

// // Import routes
// import userRouters from './src/routes/userRouters.js';
// import challengeParticipantRouters from './src/routes/challengeParticipantRouters.js';
// import challengeRouters from './src/routes/challengeRouters.js';
// import chatMessageRouters from './src/routes/chatMessageRouters.js';
// import chatRoomRouters from './src/routes/chatRoomRouters.js';
// import commentRouters from './src/routes/commentRouters.js';
// import followerRouters from './src/routes/followerRouters.js';
// import paymentRouters from './src/routes/paymentRouters.js';
// import postRouters from './src/routes/postRouters.js';
// import profileRouters from './src/routes/profileRouters.js';
// import scoutProfileRouters from './src/routes/scoutProfileRouters.js';
// import rankingRouters from './src/routes/rankingRouters.js';
// import ratingRouters from './src/routes/ratingRouters.js';
// import scoutReportRouters from './src/routes/scoutReportRouters.js';
// import videoRouters from './src/routes/videoRouters.js';
// import videoViewRouters from './src/routes/videoViewRouters.js';
// import swaggerSpec from './src/config/swagger.js';
// import videoCategory from './src/routes/videoCategoryRoutes.js';
// import reelRouters from './src/routes/reelRoutes.js';

// import { initSocketServer } from './src/sockets/index.js';
// import { connectRedis } from './src/config/redis.js';


// const app = express();
// const prisma = new PrismaClient();
// const api = '/api';
// const PORT = process.env.PORT || 4000;

// // ─── Middleware ───────────────────────────────────────────────
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cors());

// // ─── Request Logger ─────────────────────────────────────────
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//   next();
// });

// // ─── Swagger Docs ─────────────────────────────────────────────
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// // ─── Health Check Routes ──────────────────────────────────────
// app.get('/', (req, res) => {
//   res.json({
//     message: 'Scout Backend API is running!',
//     status: 'OK',
//     environment: process.env.NODE_ENV,
//   });
// });

// app.get('/health', (req, res) => {
//   res.json({
//     status: 'healthy',
//     timestamp: new Date().toISOString(),
//     database: 'connected',
//   });
// });

// // ─── API Routes ───────────────────────────────────────────────
// app.use(`${api}/users`, userRouters);
// app.use(`${api}/challengeParticipants`, challengeParticipantRouters);
// app.use(`${api}/challenges`, challengeRouters);
// app.use(`${api}/chatMessages`, chatMessageRouters);
// app.use(`${api}/chatRooms`, chatRoomRouters);
// app.use(`${api}/comments`, commentRouters);
// app.use(`${api}/followers`, followerRouters);
// app.use(`${api}/payments`, paymentRouters);
// app.use(`${api}/posts`, postRouters);
// app.use(`${api}/profiles`, profileRouters);
// app.use(`${api}/scoutProfiles`, scoutProfileRouters);
// app.use(`${api}/rankings`, rankingRouters);
// app.use(`${api}/ratings`, ratingRouters);
// app.use(`${api}/scoutReports`, scoutReportRouters);
// app.use(`${api}/videos`, videoRouters);
// app.use(`${api}/videoViews`, videoViewRouters);
// app.use(`${api}/videoCategory`, videoCategory);
// app.use(`${api}/reels`, reelRouters);

// // ─── 404 Handler ──────────────────────────────────────────────
// app.use((req, res) => {
//   res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
// });

// // ─── Global Error Handler ─────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error(`❌ Error: ${err.message}`);
//   console.error(err.stack);
//   res.status(err.status || 500).json({
//     error: 'Something went wrong!',
//     message: process.env.NODE_ENV === 'development' ? err.message : undefined,
//   });
// });

// // ─── Start Server ─────────────────────────────────────────────
// async function startServer() {
//   try {
//     await prisma.$connect();
//     console.log('✅ Connected to the PostgreSQL database');

//     await connectRedis();
//     console.log('✅ Connected to Redis');

//     const httpServer = http.createServer(app);

//     const allowedOrigins = [ 'https://thescouterpro.com', 'https://www.thescouterpro.com',    ]; // your real list — also fixes the CORS gap flagged earlier

//     app.use(cors({ origin: allowedOrigins })); // move this up from the top-level app.use(cors())

//     const io = await initSocketServer(httpServer, allowedOrigins);
//     app.set('io', io);
//     console.log('✅ Socket.io server attached with Redis adapter');

//     const server = httpServer.listen(PORT, '0.0.0.0', () => {
//       // ...
//     });
//   } catch (error) {
//     console.error('❌ Failed to connect to the database:', error);
//     process.exit(1);
//   }
// }


// // async function startServer() {
// //   try {
// //     await prisma.$connect();
// //     console.log('✅ Connected to the PostgreSQL database');

// //     // Wrap express app in a raw http server so Socket.io can share the port
// //     const httpServer = http.createServer(app);

// //     // Attach Socket.io (connects to Redis internally, sets up JWT auth + adapter)
// //     const io = await initSocketServer(httpServer);
// //     app.set('io', io); // makes req.app.get('io') work inside your controllers
// //     console.log('✅ Socket.io server attached with Redis adapter');

// //     const server = httpServer.listen(PORT, '0.0.0.0', () => {
// //       console.log(`🚀 Server running on port ${PORT}`);
// //       console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
// //       console.log(`📚 API Docs: https://www.thescouterpro.com/api-docs`);
// //       console.log(`🏥 Health Check: https://www.thescouterpro.com/health`);
// //     });

// //     server.timeout = 300000;
// //     server.keepAliveTimeout = 310000;
// //     server.headersTimeout = 320000;
// //   } catch (error) {
// //     console.error('❌ Failed to connect to the database:', error);
// //     process.exit(1);
// //   }
// // }

// startServer();

// // ─── Graceful Shutdown ────────────────────────────────────────
// process.on('SIGINT', async () => {
//   await prisma.$disconnect();
//   console.log('🛑 Server shut down gracefully');
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   await prisma.$disconnect();
//   console.log('🛑 Server shut down gracefully');
//   process.exit(0);
// });































// // Import dependencies using ESM
// import dotenv from 'dotenv';
// dotenv.config(); // ✅ MUST be first before everything else

// import express from 'express';
// import cors from 'cors';
// import { PrismaClient } from '@prisma/client';
// import swaggerUi from 'swagger-ui-express';

// // Import routes
// import userRouters from './src/routes/userRouters.js';
// import challengeParticipantRouters from './src/routes/challengeParticipantRouters.js';
// import challengeRouters from './src/routes/challengeRouters.js';
// import chatMessageRouters from './src/routes/chatMessageRouters.js';
// import chatRoomRouters from './src/routes/chatRoomRouters.js';
// import commentRouters from './src/routes/commentRouters.js';
// import followerRouters from './src/routes/followerRouters.js';
// import paymentRouters from './src/routes/paymentRouters.js';
// import postRouters from './src/routes/postRouters.js';
// import profileRouters from './src/routes/profileRouters.js';
// import scoutProfileRouters from './src/routes/scoutProfileRouters.js'; // ✅ ensure casing matches file on disk
// import rankingRouters from './src/routes/rankingRouters.js';
// import ratingRouters from './src/routes/ratingRouters.js';
// import scoutReportRouters from './src/routes/scoutReportRouters.js';
// import videoRouters from './src/routes/videoRouters.js';
// import videoViewRouters from './src/routes/videoViewRouters.js';
// import swaggerSpec from './src/config/swagger.js';
// import videoCategory from './src/routes/videoCategoryRoutes.js'
// import reelRouters from './src/routes/reelRoutes.js';


// const app = express();
// const prisma = new PrismaClient();
// const api = '/api';
// const PORT = process.env.PORT || 4000;

// // ─── Middleware ───────────────────────────────────────────────
// app.use(express.json());
// app.use(express.urlencoded({ extended: true })); // ✅ handles form data
// app.use(cors());

// // ─── Request Logger (helpful for debugging on Render) ─────────
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//   next();
// });

// // ─── Swagger Docs ─────────────────────────────────────────────
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// // ─── Health Check Routes ──────────────────────────────────────
// app.get('/', (req, res) => {
//   res.json({
//     message: 'Scout Backend API is running!',
//     status: 'OK',
//     environment: process.env.NODE_ENV,
//   });
// });

// app.get('/health', (req, res) => {
//   res.json({
//     status: 'healthy',
//     timestamp: new Date().toISOString(),
//     database: 'connected',
//   });
// });

// // ─── API Routes ───────────────────────────────────────────────
// app.use(`${api}/users`, userRouters);
// app.use(`${api}/challengeParticipants`, challengeParticipantRouters);
// app.use(`${api}/challenges`, challengeRouters);
// app.use(`${api}/chatMessages`, chatMessageRouters);
// app.use(`${api}/chatRooms`, chatRoomRouters);
// app.use(`${api}/comments`, commentRouters);
// app.use(`${api}/followers`, followerRouters);
// app.use(`${api}/payments`, paymentRouters);
// app.use(`${api}/posts`, postRouters);
// app.use(`${api}/profiles`, profileRouters);
// app.use(`${api}/scoutProfiles`, scoutProfileRouters);
// app.use(`${api}/rankings`, rankingRouters);
// app.use(`${api}/ratings`, ratingRouters);
// app.use(`${api}/scoutReports`, scoutReportRouters);
// app.use(`${api}/videos`, videoRouters);
// app.use(`${api}/videoViews`, videoViewRouters);
// app.use(`${api}/videoCategory`,videoCategory);
// app.use(`${api}/reels`, reelRouters);


// // ─── 404 Handler ──────────────────────────────────────────────
// app.use((req, res) => {
//   res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
// });

// // ─── Global Error Handler ─────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error(`❌ Error: ${err.message}`);
//   console.error(err.stack);
//   res.status(err.status || 500).json({
//     error: 'Something went wrong!',
//     message: process.env.NODE_ENV === 'development' ? err.message : undefined,
//   });
// });

// // ─── Start Server ─────────────────────────────────────────────
// async function startServer() {
//   try {
//     await prisma.$connect();
//     console.log('✅ Connected to the PostgreSQL database');

//     const server = app.listen(PORT, '0.0.0.0', () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//       console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
//       console.log(`📚 API Docs: https://www.thescouterpro.com/api-docs`);
//       console.log(`🏥 Health Check: https://www.thescouterpro.com/health`);
//     });

//     // Increase timeouts for large file uploads
//     server.timeout = 300000;         // 5 minutes
//     server.keepAliveTimeout = 310000;
//     server.headersTimeout = 320000;

//   } catch (error) {
//     console.error('❌ Failed to connect to the database:', error);
//     process.exit(1);
//   }
// }

// startServer();

// // ─── Graceful Shutdown ────────────────────────────────────────
// process.on('SIGINT', async () => {
//   await prisma.$disconnect();
//   console.log('🛑 Server shut down gracefully');
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   await prisma.$disconnect();
//   console.log('🛑 Server shut down gracefully');
//   process.exit(0);
// });
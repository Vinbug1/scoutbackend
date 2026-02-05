// Import dependencies using ESM
import express from 'express';
import dotenv from 'dotenv';
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
import playerReportRouters from './src/routes/playerReportRouters.js';
import postRouters from './src/routes/postRouters.js';
import profileRouters from './src/routes/profileRouters.js';
import rankingRouters from './src/routes/rankingRouters.js';
import ratingRouters from './src/routes/ratingRouters.js';
import scouterReportRouters from './src/routes/scouterReportRouters.js';
import videoRouters from './src/routes/videoRouters.js';
import videoViewRouters from './src/routes/videoViewRouters.js';
import swaggerSpec from './src/config/swagger.js';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const api = '/api';
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(cors());

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Scout Backend API is running!', 
    status: 'OK',
    environment: process.env.NODE_ENV 
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Define routes - FIXED: Use parentheses () not backticks ``
app.use(`${api}/users`, userRouters);
app.use(`${api}/challengeParticipants`, challengeParticipantRouters);
app.use(`${api}/challenges`, challengeRouters);
app.use(`${api}/chatMessages`, chatMessageRouters);
app.use(`${api}/chatRooms`, chatRoomRouters);
app.use(`${api}/comments`, commentRouters);
app.use(`${api}/followers`, followerRouters);
app.use(`${api}/payments`, paymentRouters);
app.use(`${api}/playerReports`, playerReportRouters);
app.use(`${api}/posts`, postRouters);
app.use(`${api}/profiles`, profileRouters);
app.use(`${api}/rankings`, rankingRouters);
app.use(`${api}/ratings`, ratingRouters);
app.use(`${api}/scouterReports`, scouterReportRouters);
app.use(`${api}/videos`, videoRouters);
app.use(`${api}/videoViews`, videoViewRouters);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server and check DB connection
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to the PostgreSQL database');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import problemRoutes from './routes/problem.routes.js';

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB Database
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1"]);
console.log(await dns.getServers());
connectDB();

const app = express();

/**
 * Global Middleware Configuration
 */
// Enable Cross-Origin Resource Sharing (CORS) for all request origins
app.use(cors());

// Parse incoming request bodies with JSON payloads
app.use(express.json());

/**
 * API Routes & Sanity Checks
 */
// Mount Authentication Endpoints
app.use('/api/auth', authRoutes);

// Mount Problem Tracker Endpoints
app.use('/api/problems', problemRoutes);

// Primary sanity-check endpoint to verify backend status
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the LeetLens API!',
    phase: 'Phase 3 - Core Problem Tracker Active',
    timestamp: new Date().toISOString()
  });
});

/**
 * Centralized API Error Handling Middleware
 */
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server encountered an unexpected status error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

/**
 * Global Error and Server Port Handling
 */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is listening in development mode on port ${PORT}`);
  console.log(`🔗 Health Check URL: http://localhost:${PORT}/`);
});

/**
 * Global Unhandled Promise Rejection Handler
 * 
 * In production-ready Node.js environments, unhandled promise rejections should
 * be caught, logged, and the server gracefully shut down to avoid unstable states.
 */
process.on('unhandledRejection', (err, promise) => {
  console.error(`=========================================`);
  console.error(`🔥 Unhandled Promise Rejection Detected!`);
  console.error(` Error Details: ${err.message || err}`);
  console.error(`=========================================`);
  
  // Close server & exit process
  server.close(() => process.exit(1));
});

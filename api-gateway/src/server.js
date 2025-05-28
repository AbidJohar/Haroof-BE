import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import Redis from 'ioredis';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import logger from './utils/logger.js';
import proxy from 'express-http-proxy';
import cookieParser from 'cookie-parser';
import errorHandler from './middlewares/errorHandler.js';
import validateToken from './middlewares/validateToken.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const redisClient = new Redis(process.env.REDIS_URL);
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];

// Middlewares
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || '*'); // Reflect the request's Origin
    } else {
      logger.warn(`CORS rejected for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
}));

// Conditionally skip JSON parsing for multipart requests
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    return next();
  }
  express.json()(req, res, next);
});

// Smart logging: log body and headers
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url} from origin: ${req.headers.origin}`);
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
  }
  next();
});

const ratelimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests',
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, '/api');
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Error in proxy: ${err.message}`);
    res.status(500).json({
      message: 'Internal server error',
      error: err.message,
    });
  },
};

// User service proxy
app.use('/v1/auth',ratelimiter, proxy(process.env.USER_SERVICE_URL, {
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    const contentType = srcReq.headers['content-type'];
    if (contentType) {
      proxyReqOpts.headers['Content-Type'] = contentType;
    }
    if (srcReq.headers['cookie']) {
      proxyReqOpts.headers['Cookie'] = srcReq.headers['cookie'];
    }
    if (contentType && contentType.startsWith('multipart/form-data')) {
      proxyReqOpts.body = srcReq.body;
    }
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    logger.info(`Response received from user-service: ${proxyRes.statusCode}`);
    return proxyResData;
  },
}));

// Book service proxy
app.use('/v1/books', validateToken, proxy(process.env.BOOK_SERVICE_URL, {
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    const userId = srcReq.isAdmin ? 'admin' : srcReq.user?.userId;
    if (!userId) {
      logger.warn('No userId found in req.user or isAdmin not set');
      proxyReqOpts.headers['x-user-id'] = 'unknown';
    } else {
      proxyReqOpts.headers['x-user-id'] = userId;
      logger.info(`Setting x-user-id: ${userId}`);
    }
    const contentType = srcReq.headers['content-type'];
    if (contentType) {
      proxyReqOpts.headers['Content-Type'] = contentType;
    }
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    logger.info(`Response received from Book-service: ${proxyRes.statusCode}`);
    return proxyResData;
  },
}));

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`API Gateway running on port: ${port}`);
  logger.info(`User service URL: ${process.env.USER_SERVICE_URL}`);
  logger.info(`Book service URL: ${process.env.BOOK_SERVICE_URL}`);
  logger.info(`Redis URL: ${process.env.REDIS_URL}`);
});
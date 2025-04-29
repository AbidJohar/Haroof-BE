import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import Redis from 'ioredis';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import logger from './utils/logger.js';
import proxy from 'express-http-proxy';
import errorHandler from './middlewares/errorHandler.js';
import validateToken from './middlewares/validateToken.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const redisClient = new Redis(process.env.REDIS_URL);

//________________________( middlewares )_______________________
app.use(helmet());
app.use(cors());

// ✅ Conditionally skip JSON parsing for multipart requests
app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.startsWith('multipart/form-data')) {
        return next(); // skip express.json()
    }
    express.json()(req, res, next);
});

// ✅ Smart logging: log body only if JSON
app.use((req, res, next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
        logger.info(`Request body: ${JSON.stringify(req.body)}`);
    }
    next();
});

const ratelimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
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

app.use(ratelimiter);

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

//_______________(setting up proxy for our User_service)____________
app.use('/v1/auth',
    proxy(process.env.USER_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            const contentType = srcReq.headers['content-type'];
            if (contentType) {
                proxyReqOpts.headers['Content-Type'] = contentType;
            }
            return proxyReqOpts;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from user-service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
    })
);

//_______________(setting up proxy for our Book_service)____________
app.use('/v1/books',
    validateToken,
    proxy(process.env.BOOK_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
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
    })
);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
    logger.info(`API Gateway running on port: ${port}`);
    logger.info(`User service URL: ${process.env.USER_SERVICE_URL}`);
    logger.info(`Book service URL: ${process.env.BOOK_SERVICE_URL}`);
    logger.info(`Redis URL: ${process.env.REDIS_URL}`);
});

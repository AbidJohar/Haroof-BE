import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet' 
import logger from './utils/logger.js';
import {RateLimiterRedis} from 'rate-limiter-flexible';
import Redis from 'ioredis';
import {rateLimit} from 'express-rate-limit';
import {RedisStore} from 'rate-limit-redis';
import route from './routes/userRoutes.js';

// Initialize dotenv to use environment variables
dotenv.config();

// Create an Express app
const app = express();
const PORT = process.env.PORT || 5000;

//________________( Mong DB connection setup )_____________________
mongoose.connect(process.env.MONGODB_URI )
  .then(() =>  logger.info("mongo db is connected"))
  .catch((error) => 
    logger.error("mongdb connection failed", error)
);
 

// _____________(redis connection)_____________________

const redisClient = new Redis(process.env.REDIS_URL);




//_______________( Middleware )____________________
app.use(helmet());
app.use(express.json());  // To parse JSON request bodies
app.use(express.urlencoded({ extended: true }));  // To parse URL-encoded data
app.use(cors());  // Enable CORS for all routes (modify if needed)



app.use((req,res,next)=>{
    logger.info(` Received ${req.method} request to ${req.url} `);
    next();
});


//_______________( DDoS and rate limiting protection )____________

const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'middleware',
    points: 30,
    duration: 1
});

app.use((req,res, next)=>{
    rateLimiter.consume(req.ip)
    .then( ()=> next())
    .catch(()=>{
    logger.warn(`rate limit exceed for IP : ${req.ip}`)

     res.status(429).json({
        success: false,
        message: "Too many requests"
     })
    })
});

// _________(IP based rate limiting for sensative endpoints)_________

const sensativeEndpointsRateLimiter =  rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	handler: (req,res)=>{
        logger.warn(`sensitive endpoint rate limit is exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: "Too many requests"
         });
    },
    store: new RedisStore({
        sendCommand: (...args)=> redisClient.call(...args)
    })

});




//Applying sensative_ratelimiter to routes
app.use('/api/auth/register',sensativeEndpointsRateLimiter);

// ________________________( API endpoints )___________________________
app.use('/api/auth', route)
 

// Set the port
app.listen(PORT, () => {
    logger.info(`user-service is running on port: ${PORT}`)
});

// _________________( unhandle promise rejection )______________________

process.on('unhandledRejection', (reason, promise)=>{
    logger.error("Unhandle Rejection at:", promise, "reason:",reason);
})

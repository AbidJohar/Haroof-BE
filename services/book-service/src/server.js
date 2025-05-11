import express from 'express'
import dotenv from 'dotenv';
import helmet from 'helmet';
import mongoose from 'mongoose';
import cors from 'cors';
import logger from './utils/logger.js';
import Redis from 'ioredis';
import bookRoutes from './routes/bookRoutes.js';
import cookieParser from 'cookie-parser';

dotenv.config({path: './.env'});

const app = express();
const PORT = process.env.PORT || 3002;

//________________( Mong DB connection setup )_____________________
 mongoose.connect(process.env.MONGODB_URI)
 .then(()=> logger.info("DB connected successfully"))
 .catch((err)=> logger.error("something went wrong during DB connection",err))
 
// _____________( redis connection )_____________________

const redisClient = new Redis(process.env.REDIS_URL);
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];


// ____________( middlewares )_______________
app.use(helmet());
app.use(express.json());  // To parse JSON request bodies
app.use(express.urlencoded({ extended: true }));   
app.use(cors({
         origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || '*'); // Reflect the request's Origin
    } else {
      logger.warn(`CORS rejected for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  }, // Explicit origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));   
app.use(cookieParser());


app.use((req,res,next)=>{
    logger.info(` Received ${req.method} request to ${req.url} `);
    next();
});



// ________________________( API endpoints )___________________________
app.use('/api/books', (req,res,next)=>{
    req.redisClient = redisClient;
    next();
}, bookRoutes)

 

// Set the port
app.listen(PORT, () => {
    logger.info(`Book-service is running on port: ${PORT}`)
});

// _________________( unhandle promise rejection )______________________

process.on('unhandledRejection', (reason, promise)=>{
    logger.error("Unhandle Rejection at:", promise, "reason:",reason);
})




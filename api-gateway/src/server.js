import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import Redis from 'ioredis';
import {rateLimit} from 'express-rate-limit';
import {RedisStore}   from 'rate-limit-redis';
import logger from './utils/logger.js';
import  proxy from 'express-http-proxy';
import errorHandler from './middlewares/errorHandler.js';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

//________________________( middlewares )_______________________
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req,res,next)=>{
    logger.info(` Received ${req.method} request to ${req.url} `);
    logger.info(`Request body: ${JSON.stringify(req.body)}`)
    next();
});



const ratelimiter =  rateLimit({
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

app.use(ratelimiter);

const proxyOptions = {
    proxyReqPathResolver : (req)=>{
      return req.originalUrl.replace(/^\/v1/, '/api')
    },
    proxyErrorHandler: function(err, res, next) {
        logger.error(`Error in proxy : ${err.message}`)
        res.status(500).json({
            message: "Internal server error",
            error: err.message
        })
      }
}

//_______________(setting up proxy for our User_service )____________

app.use('/v1/auth', proxy(process.env.USER_SERVICE_URL,
{
 ...proxyOptions,
 proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
      proxyReqOpts.headers['Content-Type'] = "application/json"
      return proxyReqOpts
  },
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
     logger.info(`Responce received from user-service: ${proxyRes.statusCode}`);
     return proxyResData
  }
}));

app.use(errorHandler);

app.listen(port, ()=>{
    logger.info(`Api gate is running on port: ${port}`);
    logger.info(`User service is running on port: ${process.env.USER_SERVICE_URL}`);
    logger.info(`Redis URL: ${process.env.REDIS_URL}`);
})

 
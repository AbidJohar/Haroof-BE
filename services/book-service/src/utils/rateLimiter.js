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

export default sensativeEndpointsRateLimiter;
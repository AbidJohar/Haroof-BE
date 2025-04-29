import logger from '../utils/logger.js';

const authMiddleware = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];

     
     if(!userId){
        logger.warn("Acess attempt without user ID");
        return res.status(401).json({
          success: false,
          message: "Authentication required! please login to continue.."
        })
     }
   

    req.user = {userId};  
    next(); // move to the next middleware/route
  } catch (error) {
    logger.error("Error in auth middleware", error);
    return res.status(401).json(
        { success: false,
          message: "Unauthorized: Invalid or expired token"
         });
  }
};

export default authMiddleware;

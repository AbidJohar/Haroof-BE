import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const authMiddleware = async (req, res, next) => {
    logger.info("Hit the authMiddleware..");

    try {
        const token = req.cookies.accessToken;
        if (!token) {
            logger.warn("No access token provided");
            return res.status(401).json({
                success: false,
                message: "Authentication required! Please login to continue.."
            });
        }    
           

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
           
        if (!decoded.userId) {
            logger.warn("Invalid token: No user ID in payload");
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }

        req.user = { userId: decoded.userId }; // Match uploadPhoto's req.user._id
        next();
    } catch (error) {
        logger.error("Error in auth middleware", error);
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid or expired token"
        });
    }
};

export default authMiddleware;
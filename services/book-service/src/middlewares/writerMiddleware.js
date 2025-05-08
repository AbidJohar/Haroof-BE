// middleware/writerMiddleware.js
import jwt from 'jsonwebtoken';
import Writer from '../models/writerModel.js';
import logger from '../utils/logger.js';

export const writerMiddleware = async (req, res, next) => {
  logger.info('Writer middleware is processing...');

  try {
    // Extract token from cookie

    const token = req.cookies.writerAccessToken;
    if (!token) {
      logger.warn('No access token provided');
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_WRITER);
    } catch (error) {
      logger.warn('Invalid token', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Check if writer exists
    const writer = await Writer.findOne({ email: decoded.email });
    if (!writer) {
      logger.warn('Writer not found', { email: decoded.email });
      return res.status(401).json({
        success: false,
        message: 'Writer not found',
      });
    }

    req.writer = writer;
    logger.info('Writer authenticated', { email: writer.email });
    next();
  } catch (error) {
    logger.error('Error in writer middleware', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
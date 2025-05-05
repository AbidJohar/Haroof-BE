// controllers/writerController.js
import { writerValidation } from '../utils/validation.js';
import Writer from '../models/writerModel.js';
import logger from '../utils/logger.js';  
import jwt from 'jsonwebtoken';
import { uploadonCloudinay } from '../utils/cloudinary.js';

export const becomeWriter = async (req, res) => {
    logger.info('Become Writer endpoint is hitting...');
  
    try {
      // Validate the request body
      const { error } = writerValidation(req.body);
      if (error) {
        logger.warn('Validation error', error.details[0].message);
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      if (!req.file) {
        logger.warn("No cover image file found.");
        return res.status(404).json({
          success: false,
          message: "No cover image file found. Please add a file and try again!",
        });
      }
  
  
      const { originalname, mimetype, buffer } = req.file;
      logger.info(`File details: originalName: ${originalname}, type: ${mimetype}`);
      logger.info('Uploading profile image to Cloudinary...');
  
      // Upload profile image to Cloudinary
      const profileImageResult = await uploadonCloudinay(req.file);
      logger.info(`Profile image uploaded successfully. Cloudinary public ID: ${profileImageResult.public_id}`);
  
      // Extract fields from request body
      const {
        fullName,
        bio,
        email,
        paymentAccountNumber,
        addressLine,
        city,
        state,
        postalCode,
        country,
      } = req.body;
  
      // Create new writer
      const newWriter = new Writer({
        fullName,
        writerProfileImage: profileImageResult.secure_url,
        bio,
        email,
        paymentAccountNumber,
        addressLine,
        city,
        state,
        postalCode,
        country,
      });
  
      // Save writer to database
      await newWriter.save();
      logger.info('Writer created successfully', { writerId: newWriter._id });
  
      // Generate JWT access token
      const accessToken = jwt.sign(
        { email: newWriter.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      logger.info('Access token generated', { email: newWriter.email });
  
      return res.status(201).json({
        success: true,
        message: 'Writer created successfully',
        writer: newWriter,
        accessToken,
      });
    } catch (error) {
      // Handle duplicate email error
      if (error.code === 11000) {
        logger.warn('Duplicate email error', error);
        return res.status(400).json({
          success: false,
          message: 'A writer with this email already exists',
        });
      }
  
      logger.error('Error while creating writer', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
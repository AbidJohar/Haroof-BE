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
      logger.warn('No cover image file found.');
      return res.status(404).json({
        success: false,
        message: 'No cover image file found. Please add a file and try again!',
      });
    }

    // Ensure user is authenticated
    const userId = req.user?.userId; // From JWT payload
    if (!userId) {
      logger.warn('No user ID provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if writer already exists for this user
    const existingWriter = await Writer.findOne({ userId });
    if (existingWriter) {
      logger.warn(`Writer already exists for user ID ${userId}`);
      return res.status(400).json({
        success: false,
        message: 'You already have a writer profile',
      });
    }

    const { originalname, mimetype } = req.file;
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

    // Check if writer with email already exists
    const existWriter = await Writer.findOne({ email });
    if (existWriter) {
      logger.warn(`Writer with email ${email} already exists`);
      return res.status(400).json({
        success: false,
        message: 'A writer with this email already exists',
      });
    }

    // Generate JWT writerAccessToken
    const writerAccessToken = jwt.sign(
      { email, userId },
      process.env.JWT_SECRET_WRITER,
      { expiresIn: '30d' }
    );
    logger.info('Writer access token generated');

    // Create new writer
    const newWriter = new Writer({
      userId,
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
      writerAccessToken, // Store token in DB
    });

    // Save writer to database
    await newWriter.save();
    logger.info('Writer created successfully', { writerId: newWriter._id });

    // Set HTTP-only cookie
    res.cookie('writerAccessToken', writerAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return res.status(201).json({
      success: true,
      message: 'Writer profile created successfully',
      writer: newWriter,
    });
  } catch (error) {
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

// _________________( fetch existing writer )___________

export const getWriterProfile = async (req, res) => {
  logger.info('Get Writer Profile endpoint is hitting...');

  try {
    // Ensure user is authenticated
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn('No user ID provided in token');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Find writer by userId
    let writer = await Writer.findOne({ userId }).select('-__v');
    if (!writer) {
      logger.info(`No writer profile found for user ID ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'No writer profile found',
      });
    }

    // Restore writerAccessToken from database
    let writerAccessToken = writer.writerAccessToken;
    if (writerAccessToken) {
      try {
        // Verify token is valid
        jwt.verify(writerAccessToken, process.env.JWT_SECRET_WRITER);
      } catch (error) {
        logger.warn('Stored writerAccessToken is invalid', { error: error.message, userId });
        writerAccessToken = null;
      }
    } else{
      return res.status(404).json({
        success: false,
        message: " no writer access Token found!"
      })
    }

    // // Generate new token only if missing or invalid
    // if (!writerAccessToken) {
    //   writerAccessToken = jwt.sign(
    //     { email: writer.email, userId },
    //     process.env.JWT_SECRET_WRITER,
    //     { expiresIn: '30d' }
    //   );
    //   writer = await Writer.findByIdAndUpdate(
    //     writer._id,
    //     { writerAccessToken },
    //     { new: true }
    //   );
    //   logger.info('New writerAccessToken generated and stored', { writerId: writer._id, userId });
    // }

    // Set writerAccessToken cookie
    res.cookie('writerAccessToken', writerAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    logger.info(`Writer profile retrieved and token set for user ID ${userId}`);
    return res.status(200).json({
      success: true,
      message: 'Writer profile fetched successfully',
      writer,
    });
  } catch (error) {
    logger.error('Error while fetching writer profile', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};




//____________(get all writers )___________________

 

export const getAllWriters = async (req, res) => {
  logger.info('Get All Writers endpoint is hitting...');

  try {
    // Fetch all writers and populate their books
    const writers = await Writer.find()
      .select('fullName writerProfileImage bio email city state country books')
      .populate({
        path: 'books',
        select: 'status isPublished',
      });

    // Process writers to include book counts
    const formattedWriters = writers.map((writer) => {
      const bookCount = writer.books.length;
      const pending = writer.books.filter(
        (book) => book.status?.toLowerCase() === 'pending'
      ).length;
      const rejected = writer.books.filter(
        (book) => book.status?.toLowerCase() === 'rejected'
      ).length;
      const approved = writer.books.filter(
        (book) => book.status?.toLowerCase() === 'approved'
      ).length;

      return {
        authorId: writer._id.toString(),
        name: writer.fullName,
        writerProfileImage: writer.writerProfileImage,
        bio: writer.bio || '',
        email: writer.email,
        city: writer.city || '',
        state: writer.state || '',
        country: writer.country || '',
        bookCount,
        pending,
        rejected,
        approved, // Added for completeness
      };
    });

    // Log for debugging
    logger.info('Successfully retrieved writers', { count: formattedWriters.length });
    console.log('Formatted writers:', formattedWriters); // Debug: Inspect counts

    return res.status(200).json({
      success: true,
      message: 'Writers retrieved successfully',
      writers: formattedWriters,
    });
  } catch (error) {
    logger.error('Error while retrieving writers', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export default getAllWriters;


//__________________( delete writer by id)_____________

export const deleteWriter = async (req, res) => {
  logger.info('Delete Writer endpoint is hitting...');

  try {
    // Get writer from writerMiddleware
    const writer = req.writer;
    if (!writer) {
      logger.warn('Writer not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Writer not authenticated',
      });
    }

    // Delete writer from database
    await Writer.deleteOne({ _id: writer._id });
    logger.info('Writer deleted successfully', { writerId: writer._id });

    // Clear the writerAccessToken cookie
    res.clearCookie('writerAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({
      success: true,
      message: 'Writer account deleted successfully',
    });
  } catch (error) {
    logger.error('Error while deleting writer', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
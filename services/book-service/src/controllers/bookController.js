import Book from '../models/bookModel.js';
import { uploadonCloudinay } from '../utils/cloudinary.js';
import logger from '../utils/logger.js';  
import { bookValidation} from '../utils/validation.js'; 


// ____________________(Create Book Controller)____________________

 const createBook = async (req, res) => {
  logger.info("Create Book endpoint is hitting...");

  try {
    const { error } = bookValidation(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    if(!req.file){
      logger.warn("No file found. please add a file and add again!");
      return res.status(404).json({
        success: false,
        message: "No file found. please add a file and add again!"
      })
    }

    const {originalname,mimeType, buffer} = req.file;
     
    logger.info(`File details: originalName: ${originalname} type: ${mimeType}`);
    logger.info(`uploading to cloudinary starting...`);
    
    const result = await uploadonCloudinay(req.file);
    
    logger.info(`cloudinary upload successfully. public ID: ${result.public_id}`);



    const { title, description, category,} = req.body;
     
    console.log("req.user:",req.user);
    
    const authorId = req.user.userId;

    const newBook = new Book({
      title,
      authorId,
      coverImage: result.secure_url,
      description,
      category,
    });

    await newBook.save();
    logger.info("Book created successfully", { bookId: newBook._id });

    return res.status(201).json({
      success: true,
      message: "Book created successfully",
      book: newBook,
    });

  } catch (error) {
    logger.error("Error while creating book", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




export {createBook};
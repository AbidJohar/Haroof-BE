import Book from '../models/bookModel.js';
import { uploadonCloudinay } from '../utils/cloudinary.js';
import logger from '../utils/logger.js';  
import { bookValidation } from '../utils/validation.js';
import  encryptAndUploadContent from '../utils/encryptAndSaveContent.js'

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

    if (!req.file) {
      logger.warn("No cover image file found.");
      return res.status(404).json({
        success: false,
        message: "No cover image file found. Please add a file and try again!",
      });
    }

    const { originalname, mimetype, buffer } = req.file;

    logger.info(`File details: originalName: ${originalname}, type: ${mimetype}`);
    logger.info(`Uploading cover image to Cloudinary...`);
    
    const coverImageResult = await uploadonCloudinay(req.file);

    logger.info(`Cover image uploaded successfully. Cloudinary public ID: ${coverImageResult.public_id}`);

    const { title, description, category, content } = req.body;
    const authorId = req.user.userId;

    logger.info(`Encrypting and uploading book content to Cloudinary...`);
    const contentFileUrl = await encryptAndUploadContent(content, title.replace(/\s+/g, '_').toLowerCase());
    logger.info(`Book content uploaded successfully.`);

    const newBook = new Book({
      title,
      authorId,
      coverImage: coverImageResult.secure_url,
      description,
      content: contentFileUrl, // encrypted file URL
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

//__________________(fetch all books)___________________

const getAllBooks = async (req, res) => {
  logger.info("Fetching all books...");

  try {
    const books = await Book.find();
    logger.info("Books fetched successfully", { count: books.length });

    return res.status(200).json({
      success: true,
      message: "Books fetched successfully",
      books,
    });
  } catch (error) {
    logger.error("Error while fetching books", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


//_____________________(get book by ID)______________

const getBookById = async (req, res) => {
  logger.info(`GetBook by Id is hitting...`);


  const { id } = req.params;


  try {
    const book = await Book.findById(id);
    if (!book) {
      logger.warn("Book not found", { bookId: id });
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    logger.info("Book fetched successfully", { bookId: book._id });

    return res.status(200).json({
      success: true,
      message: "Book fetched successfully",
      book,
    });
  } catch (error) {
    logger.error("Error while fetching book", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


//________________(delete book by id)________________

const deleteBookById = async (req, res) => {
  const { id } = req.params;

  logger.info(`Deleting book with ID: ${id}`);

  try {
    const book = await Book.findByIdAndDelete(id);
    if (!book) {
      logger.warn("Book not found", { bookId: id });
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    logger.info("Book deleted successfully", { bookId: book._id });

    return res.status(200).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    logger.error("Error while deleting book", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export { createBook,getAllBooks,deleteBookById,getBookById };

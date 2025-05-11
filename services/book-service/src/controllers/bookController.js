import Book from '../models/bookModel.js';
import { uploadonCloudinay } from '../utils/cloudinary.js';
import logger from '../utils/logger.js';  
import { bookValidation } from '../utils/validation.js';
import  encryptAndUploadContent from '../utils/encryptAndSaveContent.js';
import axios from 'axios';
import {createDecipheriv} from 'crypto';
import { promisify } from 'util';
import zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

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
    const authorId = req.writer._id;

    logger.info(`Encrypting and uploading book content to Cloudinary...`);
    const { secure_url, key, vector } = await encryptAndUploadContent(content, title.replace(/\s+/g, '_').toLowerCase());
    logger.info(`Book content uploaded successfully.`);

    const newBook = new Book({
      title,
      authorId,
      coverImage: coverImageResult.secure_url,
      description,
      content: secure_url,
      contentKey: key,
      contentIV: vector,
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


//______________( For admin)_______________

const admin_getAllBooks = async (req, res) => {
  logger.info("Fetching all books...");

  try {
    // Populate the 'authorId' field to include the writer's fullName
    const books = await Book.find().populate('authorId', 'fullName');
    logger.info("Books fetched successfully", { count: books.length });

    // Log books with missing authorId for debugging
    const booksWithMissingAuthor = books.filter(book => !book.authorId);
    if (booksWithMissingAuthor.length > 0) {
      logger.warn("Some books have missing or invalid authorId", {
        bookIds: booksWithMissingAuthor.map(book => book._id.toString()),
        service: "book-service",
        timestamp: new Date().toISOString(),
      });
    }

    // Format books to match frontend expectations
    const formattedBooks = books.map(book => ({
      id: book._id.toString(),
      title: book.title,
      author: book.authorId?.fullName || 'Unknown',
      category: book.category || 'N/A',
      status: book.isPublished ? 'approved' : 'pending',
      description: book.description || '',
      coverImage: book.coverImage,
      readByUsers: book.readByUsers || 0,
      likes: book.likes || 0,
      content:book.content,
      dislikes: book.dislikes || 0,
      comments: book.comments?.length || 0,
    }));

    return res.status(200).json({
      success: true,
      message: "Books fetched successfully",
      books: formattedBooks,
    });
  } catch (error) {
    logger.error("Error while fetching books", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

//_____________( decrypt the writer content )__________________

const admin_getDecryptedBookById = async (req, res) => {
  const { id } = req.params;

  try {
    logger.info("Admin_get decrypted book by ID is hitting...")
    const book = await Book.findById(id).populate('authorId', 'fullName');
    console.log("book",book);
    
    if (!book) {
      logger.warn("Book not found", { bookId: id, service: "book-service" });
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (!book.authorId) {
      logger.warn("Book has invalid authorId", { bookId: id, service: "book-service" });
    }

    // Fetch and decrypt content
    let decryptedContent = 'No content available';
    if (book.content && book.contentKey && book.contentIV) {
      console.log("book contentkey and contentIv", book.contentKey, "  ", book.contentIV);
      
      try {
        const response = await axios.get(book.content, { responseType: 'arraybuffer' });
        const encryptedData = Buffer.from(response.data);

        // Convert hex to Buffers
        const key = Buffer.from(book.contentKey, 'hex');
        const iv = Buffer.from(book.contentIV, 'hex');

        // Decrypt
        const decipher = createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        // Decompress gzip
        decryptedContent = (await gunzip(decrypted)).toString('utf8');
      } catch (err) {
        logger.error("Error decrypting content", { error: err.message, bookId: id });
        decryptedContent = 'Error decrypting content';
      }
    }

    const formattedBook = {
      id: book._id.toString(),
      title: book.title,
      author: book.authorId?.fullName || 'Unknown',
      category: book.category || 'N/A',
      status: book.isPublished ? 'approved' : 'pending',
      description: book.description || '',
      readByUsers: book.readByUsers || 0,
      likes: book.likes || 0,
      dislikes: book.dislikes || 0,
      comments: book.comments?.length || 0,
      coverImage: book.coverImage || '',
    };

    return res.status(200).json({
      success: true,
      message: "Book fetched successfully",
      book: formattedBook,
      content: decryptedContent,
    });
  } catch (error) {
    logger.error("Error fetching book", { error: error.message, bookId: id });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export { createBook,getAllBooks,deleteBookById,getBookById,admin_getAllBooks,admin_getDecryptedBookById };

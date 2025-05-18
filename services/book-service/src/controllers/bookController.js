import Book from '../models/bookModel.js';
import Writer from '../models/writerModel.js';
import { uploadonCloudinay } from '../utils/cloudinary.js';
import logger from '../utils/logger.js';  
import { bookValidation } from '../utils/validation.js';
import  encryptAndUploadContent from '../utils/encryptAndSaveContent.js';
import axios from 'axios';
import {createDecipheriv} from 'crypto';
import { promisify } from 'util';
import zlib from 'zlib';
import striptags from 'striptags';

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

    // Update writer's books array
    await Writer.findByIdAndUpdate(
      authorId,
      { $push: { books: newBook._id } },
      { new: true }
    );
    logger.info('Writer updated with new book', { writerId: authorId, bookId: newBook._id });

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
  logger.info("Fetching all books with writer details...");

  try {
    const books = await Book.find()
      .populate('authorId', 'fullName followers writerProfileImage')
      .lean(); // Use lean() for better performance

    if (!books || books.length === 0) {
      logger.warn("No books found");
      return res.status(404).json({
        success: false,
        message: "No books found",
      });
    }

    // Format books with writer details
    const formattedBooks = books.map((book) => ({
      _id: book._id.toString(),
      title: book.title || 'Untitled',
      description: book.description || '',
      coverImage: book.coverImage || '',
      category: book.category || 'N/A',
      status: book.status || (book.isPublished ? 'approved' : 'pending'),
      readByUsers: book.readByUsers || 0,
      likes: book.likes || 0,
      dislikes: book.dislikes || 0,
      writer: {
        fullName: book.authorId?.fullName ||book.fullName || 'Unknown',
        followers: book.authorId?.followers ? 
          (Array.isArray(book.authorId.followers) ? book.authorId.followers.length : book.authorId.followers) : 0,
        writerProfileImage: book.authorId?.writerProfileImage || '',
      },
    }));

    logger.info("Books fetched successfully", { count: formattedBooks.length });

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
};


//_____________________(get writer book by ID)______________


const getBooksByWriterId = async (req, res) => {
  logger.info(`GetBooks by WriterId is hitting...`, { writerId: req.params.id });
  const { id } = req.params;

  try {
   
    // Fetch all books using authorId
    const books = await Book.find({ authorId: id });
    logger.info('Books queried', {
      writerId: id,
      bookCount: books.length,
      books: books.map(b => ({
        id: b._id.toString(),
        title: b.title,
        status: b.status,
        authorId: b.authorId.toString(),
      })),
    });

    return res.status(200).json({
      success: true,
      message: books.length > 0 ? 'Books fetched successfully' : 'No books found for this writer',
      books: books || [],
    });
  } catch (error) {
    logger.error('Error while fetching books', { error, writerId: id });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
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

const getDecryptedBookById = async (req, res) => {
  const { id } = req.params;
    console.log("book id:",id);
    
  try {
    logger.info('Get decrypted book by ID is hitting...');
    const book = await Book.findById(id).populate('authorId', 'fullName');

    if (!book) {
      logger.warn('Book not found', { bookId: id, service: 'book-service' });
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    if (!book.authorId) {
      logger.warn('Book has invalid authorId', { bookId: id, service: 'book-service' });
    }

    // Fetch and decrypt content
    let decryptedContent = 'No content available';
    if (book.content && book.contentKey && book.contentIV) {
      logger.info('Decrypting book content', { bookId: id, contentKey: book.contentKey, contentIV: book.contentIV });

      try {
       
        const response = await axios.get(book.content, { responseType: 'arraybuffer' });
        const encryptedData = Buffer.from(response.data);
        logger.info('Fetched encrypted data', { bookId: id, dataLength: encryptedData.length });

        // Convert hex to Buffers
        const key = Buffer.from(book.contentKey, 'hex');
        const iv = Buffer.from(book.contentIV, 'hex');

        // Decrypt
        const decipher = createDecipheriv('aes-256-cbc', key, iv);
        let decrypted;
        try {
          decrypted = decipher.update(encryptedData);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          logger.info('Decrypted data', { bookId: id, decryptedLength: decrypted.length });
        } catch (decipherErr) {
          logger.error('Decryption failed', { error: decipherErr.message, bookId: id });
          throw new Error('Decryption error');
        }

        // Decompress gzip
        try {
          decryptedContent = (await gunzip(decrypted)).toString('utf8');
          // Strip HTML tags
          decryptedContent = striptags(decryptedContent);
          logger.info('Decompressed and cleaned content', { bookId: id, contentLength: decryptedContent.length });
        } catch (gunzipErr) {
          logger.warn('Gzip decompression failed, attempting raw content', { error: gunzipErr.message, bookId: id });
          // Fallback: try interpreting decrypted data as raw text
          try {
            decryptedContent = decrypted.toString('utf8');
            // Strip HTML tags
            decryptedContent = striptags(decryptedContent);
            logger.info('Raw content retrieved', { bookId: id, contentLength: decryptedContent.length });
          } catch (rawErr) {
            logger.error('Raw content decoding failed', { error: rawErr.message, bookId: id });
            throw new Error('Decompression error: invalid content format');
          }
        }
      } catch (err) {
        logger.error('Error decrypting content', { error: err.message, bookId: id });
        decryptedContent = `Error decrypting content: ${err.message}`;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'fetch decrypted Content successfully',
      content: decryptedContent,
    });
  } catch (error) {
    logger.error('Error fetching book', { error: error.message, bookId: id });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


//______________(Controllers  For admin)_______________

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
      status: book.status || 'pending',
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
    logger.info('Admin_get decrypted book by ID is hitting...');
    const book = await Book.findById(id).populate('authorId', 'fullName');

    if (!book) {
      logger.warn('Book not found', { bookId: id, service: 'book-service' });
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    if (!book.authorId) {
      logger.warn('Book has invalid authorId', { bookId: id, service: 'book-service' });
    }

    // Fetch and decrypt content
    let decryptedContent = 'No content available';
    if (book.content && book.contentKey && book.contentIV) {
      logger.info('Decrypting book content', { bookId: id, contentKey: book.contentKey, contentIV: book.contentIV });

      try {
       
        const response = await axios.get(book.content, { responseType: 'arraybuffer' });
        const encryptedData = Buffer.from(response.data);
        logger.info('Fetched encrypted data', { bookId: id, dataLength: encryptedData.length });

        // Convert hex to Buffers
        const key = Buffer.from(book.contentKey, 'hex');
        const iv = Buffer.from(book.contentIV, 'hex');

        // Decrypt
        const decipher = createDecipheriv('aes-256-cbc', key, iv);
        let decrypted;
        try {
          decrypted = decipher.update(encryptedData);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          logger.info('Decrypted data', { bookId: id, decryptedLength: decrypted.length });
        } catch (decipherErr) {
          logger.error('Decryption failed', { error: decipherErr.message, bookId: id });
          throw new Error('Decryption error');
        }

        // Decompress gzip
        try {
          decryptedContent = (await gunzip(decrypted)).toString('utf8');
          // Strip HTML tags
          decryptedContent = striptags(decryptedContent);
          logger.info('Decompressed and cleaned content', { bookId: id, contentLength: decryptedContent.length });
        } catch (gunzipErr) {
          logger.warn('Gzip decompression failed, attempting raw content', { error: gunzipErr.message, bookId: id });
          // Fallback: try interpreting decrypted data as raw text
          try {
            decryptedContent = decrypted.toString('utf8');
            // Strip HTML tags
            decryptedContent = striptags(decryptedContent);
            logger.info('Raw content retrieved', { bookId: id, contentLength: decryptedContent.length });
          } catch (rawErr) {
            logger.error('Raw content decoding failed', { error: rawErr.message, bookId: id });
            throw new Error('Decompression error: invalid content format');
          }
        }
      } catch (err) {
        logger.error('Error decrypting content', { error: err.message, bookId: id });
        decryptedContent = `Error decrypting content: ${err.message}`;
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
      message: 'Book fetched successfully',
      book: formattedBook,
      content: decryptedContent,
    });
  } catch (error) {
    logger.error('Error fetching book', { error: error.message, bookId: id });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

//_________________( admin getbookbyID)___________

  const admin_getAllBooksById = async (req, res) => {
  const { id } = req.params;
  logger.info(`Fetching all books by authorId: ${id}`);

  try {
    const books = await Book.find({ authorId: id })
      .populate('authorId', 'fullName');

    if (!books || books.length === 0) {
      logger.warn(`No books found for authorId: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'No books found for this author',
      });
    };

       const formattedBooks = books.map((book) => ({
      id: book._id.toString(),
      title: book.title,
      author: book.authorId?.fullName || 'Unknown',
      category: book.category || 'N/A',
      status: book.status || (book.isPublished ? 'approved' : 'pending'),
      description: book.description || '',
      coverImage: book.coverImage || '',
    }));

    logger.info(`Books fetched successfully for authorId: ${id}`, { count: formattedBooks.length });

    return res.status(200).json({
      success: true,
      message: 'Books fetched successfully',
      books: formattedBooks,
    });
  } catch (error) {
    logger.error(`Error fetching books for authorId: ${id}`, { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// __________________( Admin approve book by id )_______________

const admin_approveBook = async (req, res) => {
  logger.info(`Approving book with ID: ${req.params.id}`);
  const { id } = req.params;
  
  try {
    const book = await Book.findById(id);
    if (!book) {
      logger.warn('Book not found', { id });
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }
    
    book.status = 'approved';
    book.isPublished = true;
    await book.save();
    
    logger.info('Book approved successfully', { id });
    return res.status(200).json({
      success: true,
      message: 'Book approved successfully',
      book,
    });
  } catch (error) {
    logger.error('Error approving book', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
// __________________( Admin reject book by id )_______________

const admin_rejectBook = async (req, res) => {
  logger.info(`Rejecting book with ID: ${req.params.id}`);
  const { id } = req.params;

  try {
    const book = await Book.findById(id);
    if (!book) {
      logger.warn('Book not found', { id });
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    book.status = 'rejected';
    book.isPublished = false;
    await book.save();

    logger.info('Book rejected successfully', { id });
    return res.status(200).json({
      success: true,
      message: 'Book rejected successfully',
      book,
    });
  } catch (error) {
    logger.error('Error rejecting book', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};




export { createBook,getAllBooks,getDecryptedBookById,admin_approveBook,admin_rejectBook, admin_getAllBooksById,deleteBookById,getBooksByWriterId,admin_getAllBooks,admin_getDecryptedBookById };

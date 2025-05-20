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
    // Validate request body
    const { error } = bookValidation(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { bookId, title, description, category, content } = req.body;
    const authorId = req.writer._id;

    let coverImageUrl = null;
    let updatedBook;

    if (bookId) {
      // Update existing draft
      logger.info('Processing draft submission with bookId:', { bookId });

      // Retrieve draft
      const draft = await Book.findOne({ _id: bookId, authorId, isDraft: true });
      if (!draft) {
        logger.warn(`Draft not found or unauthorized`, { bookId, authorId });
        return res.status(404).json({
          success: false,
          message: 'Draft not found or you are not authorized to submit it',
        });
      }

      // Use existing coverImage URL if no new file provided
      coverImageUrl = draft.coverImage;
      if (req.file) {
        const { originalname, mimetype } = req.file;
        logger.info(`File details: originalName: ${originalname}, type: ${mimetype}`);
        logger.info(`Uploading cover image to Cloudinary...`);

        const coverImageResult = await uploadonCloudinay(req.file);
        if (!coverImageResult?.secure_url) {
          logger.error('Failed to upload cover image to Cloudinary');
          return res.status(500).json({
            success: false,
            message: 'Failed to upload cover image',
          });
        }
        coverImageUrl = coverImageResult.secure_url;
        logger.info(`Cover image uploaded successfully. Cloudinary public ID: ${coverImageResult.public_id}`);
      } else {
        logger.info('No new cover image provided, using existing coverImage URL');
      }

      // Encrypt and upload content
      logger.info(`Encrypting and uploading book content to Cloudinary...`);
      const { secure_url, key, vector } = await encryptAndUploadContent(content, title.replace(/\s+/g, '_').toLowerCase());
      logger.info(`Book content uploaded successfully.`);

      // Update draft for submission
      updatedBook = await Book.findOneAndUpdate(
        { _id: bookId, authorId, isDraft: true },
        {
          title,
          description,
          category,
          coverImage: coverImageUrl,
          content: secure_url, // Clear raw content
          contentKey: key,
          contentIV: vector,
          isDraft: false,
          isPublished: false,
          lastEdited: new Date(),
        },
        { new: true }
      );

      if (!updatedBook) {
        logger.error('Failed to update draft for submission', { bookId });
        return res.status(500).json({
          success: false,
          message: 'Failed to submit book',
        });
      }

      logger.info('Draft submitted successfully', { bookId: updatedBook._id });
    } else {
      // Create new book directly
      logger.info('Creating new book for submission....');

      // Require cover image file
      if (!req.file) {
        logger.warn('No cover image file provided for new book');
        return res.status(400).json({
          success: false,
          message: 'Cover image is required for new book submission',
        });
      }

      const { originalname, mimetype } = req.file;
      logger.info(`File details: originalName: ${originalname}, type: ${mimetype}`);
      logger.info(`Uploading cover image to Cloudinary...`);

      const coverImageResult = await uploadonCloudinay(req.file);
      if (!coverImageResult?.secure_url) {
        logger.error('Failed to upload cover image to Cloudinary');
        return res.status(500).json({
          success: false,
          message: 'Failed to upload cover image',
        });
      }
      coverImageUrl = coverImageResult.secure_url;
      logger.info(`Cover image uploaded successfully. Cloudinary public ID: ${coverImageResult.public_id}`);

      // Encrypt and upload content
      logger.info(`Encrypting and uploading book content to Cloudinary...`);
      const { secure_url, key, vector } = await encryptAndUploadContent(content, title.replace(/\s+/g, '_').toLowerCase());
      logger.info(`Book content uploaded successfully.`);

      // Create new book
      updatedBook = new Book({
        title,
        authorId,
        description,
        category,
        coverImage: coverImageUrl,
        content: secure_url, 
        contentKey: key,
        contentIV: vector,
        isDraft: false,
        isPublished: false,
        lastEdited: new Date(),
      });

      await updatedBook.save();
      logger.info('New book submitted successfully', { bookId: updatedBook._id });
    }

    // Update writer's books array (if not already included)
    await Writer.findByIdAndUpdate(
      authorId,
      { $addToSet: { books: updatedBook._id } }, // Avoid duplicates
      { new: true }
    );
    logger.info('Writer updated with submitted book', { writerId: authorId, bookId: updatedBook._id });

    return res.status(200).json({
      success: true,
      message: 'Book submitted successfully',
      book: updatedBook,
    });

  } catch (error) {
    logger.error('Error while submitting book', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
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

    console.log("books:",books);
    

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
    const books = await Book.find({ authorId: id,isDraft: false  });
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
    const books = await Book.find({isDraft:false}).populate('authorId', 'fullName');
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


// _____________________( Draft books )_______________

const draftBook = async (req, res) => {
  logger.info('Save Draft endpoint is hitting...');
  try {
    let coverImageUrl = null;

    // Handle cover image upload if provided
    if (req.file) {
      const { originalname, mimetype } = req.file;
      logger.info(`File details: originalName: ${originalname}, type: ${mimetype}`);
      logger.info('Uploading cover image to Cloudinary...');

      const coverImageResult = await uploadonCloudinay(req.file);
      if (!coverImageResult?.secure_url) {
        logger.error('Failed to upload cover image to Cloudinary');
        return res.status(500).json({
          success: false,
          message: 'Failed to upload cover image',
        });
      }
      coverImageUrl = coverImageResult.secure_url;
    }

    const authorId = req.writer._id;
    const { bookId, title, description, category, content } = req.body;

    // Validate required fields
    if (!title) {
      logger.warn('Title is required');
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    let book;
    if (bookId) {
      // Update existing draft
      book = await Book.findOneAndUpdate(
        { _id: bookId, authorId, isDraft: true },
        {
          title,
          description,
          category,
          ...(coverImageUrl && { coverImage: coverImageUrl }), // Only update coverImage if provided
          content,
          lastEdited: new Date(),
        },
        { new: true }
      );

      if (!book) {
        logger.warn(`Draft not found or unauthorized`, { bookId, authorId });
        return res.status(404).json({
          success: false,
          message: 'Draft not found or you are not authorized to update it',
        });
      }

      logger.info(`Draft updated successfully`, { bookId: book._id });
    } else {
      // Create new draft
      book = new Book({
        title,
        authorId,
        description,
        category,
        coverImage: coverImageUrl, // Use uploaded URL or null
        content,
        isDraft: true,
        lastEdited: new Date(),
      });
      await book.save();
      logger.info(`New draft created successfully`, { bookId: book._id });
    }

    return res.status(200).json({
      success: true,
      message: bookId ? 'Draft updated successfully' : 'Draft created successfully',
      book,
    });
  } catch (err) {
    logger.error('Error saving draft', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

const getAllDrafts = async (req, res) => {
  logger.info('Get All Drafts endpoint is hitting...');
  try {
    const userId = req.writer._id;
    const drafts = await Book.find({ authorId: userId, isDraft: true }).select(
      'title coverImage description category lastEdited'
    );
    logger.info(`Fetched ${drafts.length} drafts for writer ${userId}`);
    return res.status(200).json({
      success: true,
      message: 'Drafts retrieved successfully',
      drafts,
    });
  } catch (err) {
    logger.error('Error fetching drafts', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

const getDraftById = async (req, res) => {
  logger.info('Get Draft by ID endpoint is hitting...');
  try {
    const authorId = req.writer._id;
    const { id } = req.params;

    const draft = await Book.findOne({ _id: id, authorId, isDraft: true }).select(
      'title coverImage description category content lastEdited'
    );
    console.log("draft by id:",draft);
    

    if (!draft) {
      logger.warn(`Draft not found or unauthorized access`, { draftId: id,authorId });
      return res.status(404).json({
        success: false,
        message: 'Draft not found or you are not authorized to access it',
      });
    }

    logger.info(`Fetched draft ${id} for writer ${authorId}`);
    return res.status(200).json({
      success: true,
      message: 'Draft retrieved successfully',
      draft,
    });
  } catch (err) {
    logger.error('Error fetching draft by ID', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};




export { createBook,getDraftById,draftBook,getAllDrafts,getAllBooks,getDecryptedBookById,admin_approveBook,admin_rejectBook, admin_getAllBooksById,deleteBookById,getBooksByWriterId,admin_getAllBooks,admin_getDecryptedBookById };

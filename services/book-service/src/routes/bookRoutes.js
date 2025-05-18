import express from 'express';
import { admin_approveBook, admin_getAllBooks,  admin_getAllBooksById,  admin_getDecryptedBookById, admin_rejectBook, createBook, deleteBookById, getAllBooks, getBooksByWriterId, getDecryptedBookById, } from '../controllers/bookController.js';
import {uploadFile, uploadWriterProfileImage} from '../utils/uploadfile.js';
import authmiddleware from '../middlewares/authmiddleware.js'
import multer from 'multer';
import logger from '../utils/logger.js'
import { becomeWriter, getAllWriters, deleteWriter, getWriterProfile } from '../controllers/writerController.js';
import { writerMiddleware } from '../middlewares/writerMiddleware.js';
const router = express.Router();


router.post('/create-book',authmiddleware,writerMiddleware, (req,res, next) =>{
    uploadFile(req,res,  function(error){
      if(error instanceof multer.MulterError){
           logger.error("Multer Error while uploading file..", error);
           return res.status(400).json({
            success: false,
            message: "Error during file uploading",
            error: error.message,
            stack: error.stack
           })
      } else if(error) {
        logger.error("Unknown Error while uploading file..", error);
        return res.status(500).json({
         success: false,
         message: "Unknown Error while uploading file..",
         error: error.message,
         stack: error.stack
        })
      }
      
      if(!req.file){
        logger.error("No file found..", error);
        return res.status(500).json({
         success: false,
         message: "No file found!",
        
        })
      }
      next()
    });
}, createBook );

router.get('/getallbooks', authmiddleware, getAllBooks);
router.get('/getbooks/:id', authmiddleware, getBooksByWriterId);
router.delete('/deletebook/:id', authmiddleware, deleteBookById);



//_______________(writer endpoints:)_________

router.post(
  '/become-writer',authmiddleware,
  (req, res, next) => {
    uploadWriterProfileImage(req, res, function (error) {
      if (error instanceof multer.MulterError) {
        logger.error('Multer Error while uploading writer profile image', error);
        return res.status(400).json({
          success: false,
          message: 'Error during file uploading',
          error: error.message,
          stack: error.stack,
        });
      } else if (error) {
        logger.error('Unknown Error while uploading writer profile image', error);
        return res.status(500).json({
          success: false,
          message: 'Unknown Error while uploading file',
          error: error.message,
          stack: error.stack,
        });
      }

      if (!req.file) {
        logger.warn('No writer profile image found');
        return res.status(400).json({
          success: false,
          message: 'No writer profile image found!',
        });
      }

      next();
    });
  },
  becomeWriter
);

router.get('/me-writer', authmiddleware, getWriterProfile );

router.get('/get-decrypted-book/:id', authmiddleware, getDecryptedBookById )

router.delete('/delete-writer', writerMiddleware, deleteWriter);


// ________________(Admin endpoints )___________________


router.get('/admin/getallbooks', admin_getAllBooks);
router.get('/admin/get-books-byAuthorId/:id', admin_getAllBooksById );
router.get('/admin/get-content/:id', admin_getDecryptedBookById);
router.get('/admin/get-all-writers', getAllWriters);
router.put('/admin/approve/:id',admin_approveBook);
router.put('/admin/reject/:id',admin_rejectBook);

 







export default router;
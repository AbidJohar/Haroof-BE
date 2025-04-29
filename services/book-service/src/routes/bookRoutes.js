import express from 'express';
import { createBook } from '../controllers/bookController.js';
import uploadFile from '../utils/uploadfile.js';
import authmiddleware from '../middlewares/authmiddleware.js'
import multer from 'multer';
import logger from '../utils/logger.js'
const router = express.Router();


router.post('/create-book', authmiddleware, (req,res, next) =>{
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



export default router;
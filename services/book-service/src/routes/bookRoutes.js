import express from 'express';
import { createBook } from '../controllers/bookController.js';

const router = express.Router();


router.post('/create-book', createBook );



export default router;
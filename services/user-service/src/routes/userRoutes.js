import express from 'express'
import { login, userRegistration, refreshTokenFunc,logout, uploadPhoto } from '../controllers/authController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import uploadImage from '../utils/uploadImage.js';

const router = express.Router();



router.post('/signup', userRegistration);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh-Token', refreshTokenFunc);
router.put('/update-profileImage',authMiddleware,uploadImage, uploadPhoto );


export default router;
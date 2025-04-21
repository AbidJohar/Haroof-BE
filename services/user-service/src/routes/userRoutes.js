import express from 'express'
import { login, userRegistration } from '../controllers/authController.js';

const router = express.Router();



router.post('/register', userRegistration);
router.post('/login', login);

export default router;
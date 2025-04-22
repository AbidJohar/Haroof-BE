import express from 'express'
import { login, userRegistration, refreshTokenFunc,logout } from '../controllers/authController.js';

const router = express.Router();



router.post('/register', userRegistration);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh-Token', refreshTokenFunc);

export default router;
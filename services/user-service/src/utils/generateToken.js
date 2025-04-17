import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from './logger.js';
import RefreshToken from '../models/refreshTokenModel.js';  
import { log } from 'console';

const generateToken = async (user) => {
  logger.info("hit the generateToken function");

  const accessToken = jwt.sign(
    {
      userId: user._id,
      fullName: user.fullName,
    },
    process.env.JWT_SECRET,
    { expiresIn: '40m' }
  );
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // expires in 7 days

  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt,
  });
   
  return { refreshToken, accessToken };
};

export default generateToken;

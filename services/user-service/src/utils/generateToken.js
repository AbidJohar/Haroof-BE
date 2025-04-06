import jwt from 'jsonwebtoken';
import crypto from 'crypto'
const generateToken = async (user)=>{

 const accessToken =   jwt.sign({
    userId : user._id,
    fullName: user.fullName
   }, process.env.JWT_SECRET, {expiresIn: '20m'});

   const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7) //refresh token expires in 7 days

 await refreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt
 })

 return {refreshToken,accessToken}

}

export default generateToken;
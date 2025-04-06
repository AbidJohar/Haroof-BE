import logger from '../utils/logger.js';
import { registrationValidation } from '../utils/validation.js';
import User from '../models/userModel.js'
import generateToken from '../utils/generateToken.js';

// ________________(User Registration)__________________

const userRegistration = async (req,res) =>{
     logger.info("Registration Endpoint is hitting");

    try {

     const {error} = registrationValidation(req.body);
     if(error){
        logger.warn('Validation error', error.details[0].message);
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
     }

     const {fullName,email,password} = req.body;

     let user = await User.findOne({email});

     if(user){
        logger.warn("User already exist", error.details[0].message)
     }
     user = new User({fullName, email, password})
     await user.save();
      logger.warn("user created successfully", user._id)

      const {accessToken, refreshToken} = generateToken(user);

     return res.status(200).json({
        success: true,
        message: "User registered successfully",
        accessToken,
        refreshToken
     })

        
    } catch (error) {
        logger.error("Error during registration", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        })
        
    }
}




// ________________(User login)__________________
// ________________(User logout)__________________
// ________________(Refresh Token)__________________

export {userRegistration};
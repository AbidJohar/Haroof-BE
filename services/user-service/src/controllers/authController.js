import logger from "../utils/logger.js";
import {
  loginValidation,
  registrationValidation,
} from "../utils/validation.js";
import User from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";
import RefreshToken from "../models/refreshTokenModel.js";

// ________________(User Registration)__________________

const userRegistration = async (req, res) => {
  logger.info("Registration Endpoint is hitting");

  try {
    const { error } = registrationValidation(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { fullName, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      logger.warn("User already exists", { email });
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }
    user = new User({ fullName, email, password });
    await user.save();
    logger.warn("user created successfully", user._id);

    const { accessToken, refreshToken } = await generateToken(user);

    return res.status(200).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Error during registration", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ________________(User login)__________________

const login = async (req, res) => {
  logger.info("Login endpoint is hitting");

  try {
    const { error } = loginValidation(req.body);

    if (error) {
      logger.warn("validation error during login", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        logger.warn("Invalid user");
        return res.json(400).json({
            message: false,
            message: "User doesn't exist",
        });
    }
    const isPassValid = await user.comparePassword(password);
    
    if (!isPassValid) {
        logger.warn("Invalid user");
      return res.status(400).json({
        success: false,
        message: "password is incorrect",
      });
    }
    const {refreshToken, accessToken} = await generateToken(user);

    res.status(200).json({
        success: true,
        userId : user._id,
        accessToken,
        refreshToken,
       
    });
  } catch (error) {
    logger.error("Error during login", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ________________(User logout)__________________

const logout = async (req, res) => {
  logger.info("logoutController endpoint is hitting...");

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn("Refresh token is missing in logout");
      return res.status(400).json({
        success: false,
        message: "Refresh Token is missing",
      });
    }


    // Delete the refresh token from the database
    await RefreshToken.deleteOne({token: refreshToken });

    logger.info("Refresh token deleted for logged out");

    return res.json({
      success: true,
      message: "User successfully logged out",
    });

  } catch (error) {
    logger.error("Error during logout process", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ________________(Refresh Token)__________________
 
const refreshTokenFunc  = async (req,res)=>{

  logger.info("refreshTokenFunc endpoint is hitting...");

  try {
   
    const {refreshToken} = req.body;

    if(!refreshToken){
      logger.warn("Refresh token is missing");
      return res.status(400).json({
        success: false,
        message: "Refresh Token is missing",
      });
    }

  const storedToken = await RefreshToken.findOne({token: refreshToken});

  if(!storedToken || storedToken.expiresAt < new Date()){
    logger.warn("Invalid or expired refresh token");
    
    return res.status(401).json({
      success: false,
      message: "invalid or expired refresh token"
    })

  }

  const user = await User.findById(storedToken.user);

  if(!user){
    logger.warn("user not found");
    
    return res.status(401).json({
      success: false,
      message: "user not found"
    })
  }

  const {accessToken : newAccessToken, refreshToken: newRefreshToken} = await generateToken(user);
  
  // now delete the old refresh token
   await RefreshToken.deleteOne({_id: storedToken._id})

 return  res.json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  })
    
  }  catch (error) {
    logger.error("Error during refreshing new Token", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

}


export { userRegistration, login, refreshTokenFunc, logout };

import logger from "../utils/logger.js";
import {
  loginValidation,
  registrationValidation,
} from "../utils/validation.js";
import User from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";

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
    const {refreshToken, accessToken} = generateToken(user);

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
// ________________(Refresh Token)__________________

export { userRegistration, login };

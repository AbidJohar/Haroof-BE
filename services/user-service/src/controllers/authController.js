import logger from "../utils/logger.js";
import {
  loginValidation,
  registrationValidation,
} from "../utils/validation.js";
import User from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";
import RefreshToken from "../models/refreshTokenModel.js";
import { uploadonCloudinay } from "../utils/cloudinary.js";

// ________________(User Registration)__________________

const userRegistration = async (req, res) => {
  logger.info("Registration endpoint hit..");

  try {
    // Validate input
    const { error } = registrationValidation(req.body);
    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Sanitize inputs
    const { fullName, email, password } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info(`Registration attempt with existing email`);
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = new User({
      fullName,
      email,
      password,
    });
    await user.save();
    logger.info(`User created successfully: ${user._id}`);

    const { accessToken, refreshToken } = await generateToken(user);

    // Set tokens in HTTP-only cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 40 * 60 * 1000, // 40 minutes
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error(`Error during registration: ${error.message}`);
    return res.status(500).json({
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
      return res.status(400).json({
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
    const { refreshToken, accessToken } = await generateToken(user);

    // Set tokens in HTTP-only cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 80 * 60 * 1000, // 80 minutes
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profileImage: user.profileImage
      },
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
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      logger.warn("Refresh token is missing in logout");
      return res.status(400).json({
        success: false,
        message: "Refresh Token is missing",
      });
    }

    // Delete the refresh token from the database
    await RefreshToken.deleteOne({ token: refreshToken });

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

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

const refreshTokenFunc = async (req, res) => {
  logger.info("refreshTokenFunc endpoint is hitting...");

  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      logger.warn("Refresh token is missing");
      return res.status(400).json({
        success: false,
        message: "Refresh Token is missing",
      });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired refresh token");

      return res.status(401).json({
        success: false,
        message: "invalid or expired refresh token",
      });
    }

    const user = await User.findById(storedToken.user);

    if (!user) {
      logger.warn("user not found");

      return res.status(401).json({
        success: false,
        message: "user not found",
      });
    }


    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateToken(user);

      res.cookie("accessToken", newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 40 * 60 * 1000 });
      res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });

    // now delete the old refresh token
    await RefreshToken.deleteOne({ _id: storedToken._id });

    return res.json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Error during refreshing new Token", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

 //_______________(upload profile picture )_________________

const uploadPhoto = async (req, res) => {
    logger.info("Upload photo endpoint is hitting...");

    try {
        if (!req.file) {
            logger.error("No file found in request");
            return res.status(400).json({
                success: false,
                message: "No file found in request"
            });
        }

        // Upload file to Cloudinary
        logger.info("Uploading file to Cloudinary...");
        const result = await uploadonCloudinay(req.file);
        if (!result || !result.secure_url) {
            logger.error("Cloudinary upload failed: No secure_url returned");
            return res.status(500).json({
                success: false,
                message: "Failed to upload file to Cloudinary"
            });
        }

        // Update user profileImage in DB
        logger.info(`Updating user ${req.user.userId} profile image...`);
        const user = await User.findByIdAndUpdate(
            req.user.userId, // Match authMiddleware's req.user.userId
            { profileImage: result.secure_url },
            { new: true }
        ).select('-password');

        if (!user) {
            logger.error(`User ${req.user.userId} not found`);
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile image updated successfully",
            user
        });
    } catch (err) {
        logger.error("Error in uploadPhoto", {
            message: err.message,
            stack: err.stack
        });
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: "Multer error during file upload",
                error: err.message
            });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to update profile image",
            error: err.message
        });
    }
};

 

export { userRegistration, login, refreshTokenFunc, logout,uploadPhoto };

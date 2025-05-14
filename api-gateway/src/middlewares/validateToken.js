import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

const validateToken = async (req, res, next) => {
  try {

    // to check admin person authentic or not
       // Check for admin token in headers
    const adminToken = req.headers["x-admin-token"];
    if (adminToken) {
      if (adminToken !== process.env.ADMIN_SECRET) {
        logger.warn("Invalid admin token");
        return res.status(401).json({
          success: false,
          message: "Invalid admin token",
        });
      }
      // Admin authenticated, set dummy user for x-user-id
      req.user = { userId: "admin", fullName: "Admin" }; // Adjust as needed
      req.isAdmin = true; // Optional flag for downstream logic
      logger.info("Admin authenticated via x-admin-token");
      return next();
    }



    // Extract token from cookies
    console.log("req:",req.cookies);
    const token = req.cookies?.accessToken;

    console.log("token",token);
    

    if (!token) {
      logger.warn("Access without an access token");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn("Invalid token");
        return res.status(401).json({
          success: false,
          message: "Invalid Token",
        });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    logger.warn("Error during validateToken", error.message);
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

export default validateToken;
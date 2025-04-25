import logger from "../../../services/book-service/src/utils/logger.js";
import jwt from "jsonwebtoken";

const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      logger.warn("Access without a access token");
      return res.status(404).json({
        success: false,
        message: "Authentication required",
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn("Invalid token");
        return res.status(404).json({
          success: false,
          message: "Invalid Token",
        });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    logger.warn("Error during validateTOken", error.message);
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export default validateToken;

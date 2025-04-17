import logger from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);

  return res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
};

export default errorHandler;
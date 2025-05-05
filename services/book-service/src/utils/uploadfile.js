 import multer from 'multer';

// Configure Multer with memory storage and file size limit
const storage = multer.memoryStorage();
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB limit
};

// Create a factory function to generate Multer middleware for a specific field
const createUploadMiddleware = (fieldName) => {
  return multer({
    storage,
    limits,
  }).single(fieldName);
};

// Export specific middleware for different field names
export const uploadFile = createUploadMiddleware('coverImage');
export const uploadWriterProfileImage = createUploadMiddleware('writerProfileImage');
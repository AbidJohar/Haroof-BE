// utils/uploadFileBufferToCloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';

/**
 * Uploads a buffer (e.g. encrypted content) to Cloudinary as a raw file.
 * @param {Buffer} buffer - The file buffer to upload
 * @param {string} filename - Optional: file name in Cloudinary
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadFileBufferToCloudinary = (buffer, filename = 'book') => {
  return new Promise((resolve, reject) => {
    const passthrough = new stream.PassThrough();
    passthrough.end(buffer);

    cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: filename,
        folder: 'books_encrypted', // optional folder for better organization
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

export default uploadFileBufferToCloudinary;

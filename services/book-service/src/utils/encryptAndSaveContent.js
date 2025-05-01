// utils/encryptAndUploadContent.js
import crypto from 'crypto';
import { Transform, Readable } from 'stream';
import zlib from 'zlib';
import  uploadFileBufferToCloudinary  from './uploadFilebufferToCloudinary.js';

class StreamEncryption extends Transform {
  constructor(key, vector) {
    super();
    this.key = key;
    this.vector = vector;
  }

  _transform(chunk, encoding, cb) {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.vector);
    const encrypted = Buffer.concat([cipher.update(chunk), cipher.final()]);
    this.push(encrypted);
    cb();
  }
}

const streamToBuffer = async (stream) => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

 const encryptAndUploadContent = async (content, filename = 'book') => {
  const key = crypto.randomBytes(32);
  const vector = crypto.randomBytes(16);

  const contentStream = Readable.from(content);
  const gzipStream = zlib.createGzip();
  const encryptStream = new StreamEncryption(key, vector);

  const encryptedStream = contentStream.pipe(gzipStream).pipe(encryptStream);
  const encryptedBuffer = await streamToBuffer(encryptedStream);

  const cloudinaryResult = await uploadFileBufferToCloudinary(encryptedBuffer, filename + '.txt.gz.enc');
      
  return cloudinaryResult.secure_url;
};

export default encryptAndUploadContent;
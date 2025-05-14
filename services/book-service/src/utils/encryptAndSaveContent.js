import crypto from 'crypto';
import { Transform, Readable } from 'stream';
import zlib from 'zlib';
import uploadFileBufferToCloudinary from './uploadFilebufferToCloudinary.js';

class StreamEncryption extends Transform {
  constructor(key, vector) {
    super();
    this.cipher = crypto.createCipheriv('aes-256-cbc', key, vector);
  }

  _transform(chunk, encoding, cb) {
    try {
      const encrypted = this.cipher.update(chunk);
      this.push(encrypted);
      cb();
    } catch (err) {
      cb(err);
    }
  }

  _flush(cb) {
    try {
      this.push(this.cipher.final());
      cb();
    } catch (err) {
      cb(err);
    }
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
  if (!content || content.length === 0) {
    throw new Error('Content is empty');
  }

  const key = crypto.randomBytes(32);
  const vector = crypto.randomBytes(16);

  const contentStream = Readable.from(content);
  const gzipStream = zlib.createGzip();
  const encryptStream = new StreamEncryption(key, vector);

  const encryptedStream = contentStream.pipe(gzipStream).pipe(encryptStream);
  const encryptedBuffer = await streamToBuffer(encryptedStream);

  console.log('Encrypted buffer length:', encryptedBuffer.length); // Debug log

  const cloudinaryResult = await uploadFileBufferToCloudinary(encryptedBuffer, filename + '.txt.gz.enc');

  return {
    secure_url: cloudinaryResult.secure_url,
    key: key.toString('hex'),
    vector: vector.toString('hex'),
  };
};

export default encryptAndUploadContent;
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { bucket } from './gcs-config.js';

// ========================
// 🔹 Multer Configuration
// ========================
const multerStorage = multer.memoryStorage();

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type! Only JPEG, PNG, and GIF are allowed.'), false);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      return cb(new Error('Invalid file extension! Must be JPG, PNG, or GIF.'), false);
    }

    cb(null, true);
  },
});

// ========================
// 🔹 Utility: Safe File Name
// ========================
const sanitizeFileName = (name) => {
  return name.replace(/[^a-zA-Z0-9-_\.]/g, '_').slice(0, 100);
};

// ========================
// 🔹 Compress Image by MIME Type
// ========================
/**
 * Compresses an image buffer while preserving format-specific features.
 * - JPEG → compressed JPEG
 * - PNG  → compressed PNG (preserves transparency)
 * - GIF  → returned as-is (Sharp doesn't support animated GIFs)
 *
 * @param {Buffer} buffer - Raw image buffer
 * @param {string} mimeType - Detected MIME type
 * @returns {Promise<{ buffer: Buffer, mimeType: string, extension: string }>}
 */
const compressImage = async (buffer, mimeType) => {
  const sharpInstance = sharp(buffer).resize({ width: 1024, withoutEnlargement: true });

  if (mimeType === 'image/png') {
    const compressed = await sharpInstance.png({ quality: 80 }).toBuffer();
    return { buffer: compressed, mimeType: 'image/png', extension: 'png' };
  }

  if (mimeType === 'image/gif') {
    // Skip compression — Sharp does not support animated GIFs
    return { buffer, mimeType: 'image/gif', extension: 'gif' };
  }

  // Default: JPEG
  const compressed = await sharpInstance.jpeg({ quality: 80 }).toBuffer();
  return { buffer: compressed, mimeType: 'image/jpeg', extension: 'jpg' };
};

// ========================
// 🔹 Hybrid Upload to GCS
// ========================
/**
 * Upload Base64 *or* Multer file buffer to Google Cloud Storage.
 * Automatically detects the input type and compresses images.
 *
 * @param {string|object} input - Base64 string or Multer file object
 * @param {string} directory - Folder in bucket (e.g., 'users', 'listings')
 * @returns {Promise<{ url: string, fileName: string, sizeKB: number, uploadTimeMS: number }>}
 */
const uploadMediaToGCS = async (input, directory = 'uploads') => {
  const startTime = Date.now();
  let mimeType;
  let buffer;

  try {
    // 🧩 1️⃣ Base64 Input
    if (typeof input === 'string') {
      const matches = input.match(/^data:(.+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid Base64 format');
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    }
    // 🧩 2️⃣ Multer File Input
    else if (input?.buffer && input?.mimetype) {
      mimeType = input.mimetype;
      buffer = input.buffer;
    } else {
      throw new Error('Unsupported input type');
    }

    // 🧠 Detect and validate real MIME type from buffer bytes
    const detectedType = await fileTypeFromBuffer(buffer);
    if (detectedType?.mime) mimeType = detectedType.mime;

    // ✅ Compress image and resolve final mimeType + extension AFTER compression
    let finalBuffer = buffer;
    let finalMimeType = mimeType;
    let finalExtension = mimeType.split('/')[1] || 'bin';

    if (mimeType.startsWith('image/')) {
      try {
        const result = await compressImage(buffer, mimeType);
        finalBuffer = result.buffer;
        finalMimeType = result.mimeType;
        finalExtension = result.extension;
      } catch (err) {
        console.warn('⚠️ Sharp compression failed, uploading raw buffer:', err.message);
      }
    }

    // 🗂️ Build file name using the correct post-compression extension
    const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${finalExtension}`);
    const blob = bucket.file(fileName);

    // ✅ Upload to GCS
    await new Promise((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: finalMimeType,
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      blobStream.on('error', reject);
      blobStream.on('finish', resolve);
      blobStream.end(finalBuffer);
    });

    const uploadTimeMS = Date.now() - startTime;
    const sizeKB = (finalBuffer.length / 1024).toFixed(2);

    console.log(`✅ Uploaded ${fileName} [${sizeKB} KB, ${uploadTimeMS} ms]`);

    return {
      url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
      fileName,
      sizeKB: Number(sizeKB),
      uploadTimeMS,
    };
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw new Error('Failed to upload media to GCS');
  }
};

// ========================
// 🔹 Multiple Uploads (Hybrid)
// ========================
/**
 * Upload an array of Base64 strings or Multer file objects.
 * Failed items are skipped and logged rather than failing the whole batch.
 *
 * @param {Array<string|object>} inputs - Array of Base64 strings or Multer file objects
 * @param {string} directory - Folder in bucket
 * @returns {Promise<Array<{ url: string, fileName: string, sizeKB: number, uploadTimeMS: number }>>}
 */


// ========================
// 🔹 Backward Compatibility
// ========================
const uploadBase64MediaToGCS = async (base64String, directory = 'uploads') =>
  uploadMediaToGCS(base64String, directory);

// const uploadMultipleBase64MediaToGCS = async (base64Array, directory = 'uploads') =>
//   uploadMultipleMediaToGCS(base64Array, directory);

// ========================
// 🔹 Exports
// ========================
export {
  upload,                        // Multer middleware
  uploadMediaToGCS,              // Hybrid single upload handler
  // uploadMultipleMediaToGCS,      // Hybrid multiple upload handler
  uploadBase64MediaToGCS,        // Backward compatibility (single)
  // uploadMultipleBase64MediaToGCS // Backward compatibility (multiple)
};
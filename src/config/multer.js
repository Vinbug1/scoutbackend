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

    // 🧠 Detect and validate MIME type
    const detectedType = await fileTypeFromBuffer(buffer);  // ✅ Fixed usage
    if (detectedType?.mime) mimeType = detectedType.mime;

    const extension = mimeType.split('/')[1] || 'bin';
    const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${extension}`);
    const blob = bucket.file(fileName);

    let finalBuffer = buffer;

    // ✅ Compress if image
    if (mimeType.startsWith('image/')) {
      try {
        finalBuffer = await sharp(buffer)
          .resize({ width: 1024, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch (err) {
        console.warn('⚠️ Sharp compression failed, uploading raw buffer:', err.message);
      }
    }

    // ✅ Upload to GCS
    await new Promise((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: mimeType,
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
 */
const uploadMultipleMediaToGCS = async (inputs, directory = 'uploads') => {
  if (!Array.isArray(inputs) || inputs.length === 0) return [];
  const results = await Promise.all(
    inputs.map((item) =>
      uploadMediaToGCS(item, directory).catch((err) => {
        console.error('⚠️ Skipped one media due to error:', err.message);
        return null;
      })
    )
  );
  return results.filter(Boolean);
};

// ========================
// 🔹 Backward Compatibility
// ========================
const uploadBase64MediaToGCS = async (base64String, directory = 'uploads') =>
  uploadMediaToGCS(base64String, directory);

const uploadMultipleBase64MediaToGCS = async (base64Array, directory = 'uploads') =>
  uploadMultipleMediaToGCS(base64Array, directory);

// ========================
// 🔹 Exports
// ========================
export {
  upload, // Multer middleware
  uploadMediaToGCS, // Hybrid handler
  uploadMultipleMediaToGCS, // Hybrid multiple handler
  uploadBase64MediaToGCS, // Backward compatibility
  uploadMultipleBase64MediaToGCS, // Backward compatibility
};


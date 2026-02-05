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












// import multer from 'multer';
// import path from 'path';
// import sharp from 'sharp';
// import { v4 as uuidv4 } from 'uuid';
// import { fromBuffer } from 'file-type'; // 🧠 Detect MIME from raw buffers
// import { bucket } from './gcs-config.js'; // Ensure this exports a valid GCS bucket instance

// // ========================
// // 🔹 Multer Configuration
// // ========================
// const multerStorage = multer.memoryStorage();

// const upload = multer({
//   storage: multerStorage,
//   limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
//     if (!allowedMimeTypes.includes(file.mimetype)) {
//       return cb(new Error('Invalid file type! Only JPEG, PNG, and GIF are allowed.'), false);
//     }

//     const ext = path.extname(file.originalname).toLowerCase();
//     if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
//       return cb(new Error('Invalid file extension! Must be JPG, PNG, or GIF.'), false);
//     }

//     cb(null, true);
//   },
// });

// // ========================
// // 🔹 Utility: Safe File Name
// // ========================
// const sanitizeFileName = (name) => {
//   return name.replace(/[^a-zA-Z0-9-_\.]/g, '_').slice(0, 100);
// };

// // ========================
// // 🔹 Single Base64 Upload
// // ========================
// /**
//  * Upload a single Base64-encoded media file to Google Cloud Storage.
//  * Automatically compresses & resizes images using Sharp.
//  *
//  * @param {string} base64String - Base64-encoded media string (e.g. data:image/jpeg;base64,...)
//  * @param {string} directory - GCS directory (default: 'uploads')
//  * @returns {Promise<{ url: string, fileName: string, sizeKB: number, uploadTimeMS: number }>}
//  */
// const uploadBase64MediaToGCS = async (base64String, directory = 'uploads') => {
//   if (!base64String) throw new Error('No media provided');

//   const startTime = Date.now();

//   try {
//     const matches = base64String.match(/^data:(.+);base64,(.+)$/);
//     if (!matches) throw new Error('Invalid Base64 media format');

//     let mimeType = matches[1];
//     const buffer = Buffer.from(matches[2], 'base64');

//     // 🧠 Double-check MIME type via file-type (for safety)
//     const detectedType = await fromBuffer(buffer);
//     if (detectedType?.mime) mimeType = detectedType.mime;

//     const extension = mimeType.split('/')[1] || 'bin';
//     const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${extension}`);
//     const blob = bucket.file(fileName);

//     let finalBuffer = buffer;

//     // ✅ Compress if it's an image
//     if (mimeType.startsWith('image/')) {
//       try {
//         finalBuffer = await sharp(buffer)
//           .resize({ width: 1024, withoutEnlargement: true })
//           .jpeg({ quality: 80 })
//           .toBuffer();
//       } catch (err) {
//         console.warn('⚠️ Sharp failed, uploading raw buffer:', err.message);
//       }
//     }

//     // ✅ Upload to GCS
//     await new Promise((resolve, reject) => {
//       const blobStream = blob.createWriteStream({
//         resumable: false,
//         contentType: mimeType,
//         metadata: { cacheControl: 'public, max-age=31536000' },
//       });

//       blobStream.on('error', reject);
//       blobStream.on('finish', resolve);
//       blobStream.end(finalBuffer);
//     });

//     const uploadTimeMS = Date.now() - startTime;
//     const sizeKB = (finalBuffer.length / 1024).toFixed(2);

//     console.log(`✅ Uploaded ${fileName} [${sizeKB} KB, ${uploadTimeMS} ms]`);


//     // json response

//     return response.status(200).json({
//       url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
//       fileName,
//       sizeKB: Number(sizeKB),
//       uploadTimeMS,
//     });
//   } catch (error) {
//     console.error('❌ Error uploading Base64 media:', error);
//     throw new Error('Failed to upload media to GCS');
//   }
// };

// // ========================
// // 🔹 Multiple Base64 Uploads
// // ========================
// /**
//  * Upload multiple Base64 media files (images, videos, audio, etc.) to GCS.
//  * Automatically compresses and resizes images using Sharp.
//  *
//  * @param {Array<string>} base64Array - Array of Base64 media strings
//  * @param {string} directory - Directory/folder name in your bucket (e.g. 'listings', 'users')
//  * @returns {Promise<Array<{ url: string, fileName: string, sizeKB: number, uploadTimeMS: number }>>}
//  */
// const uploadMultipleBase64MediaToGCS = async (base64Array, directory = 'uploads') => {
//   if (!Array.isArray(base64Array) || base64Array.length === 0) return [];

//   const uploadPromises = base64Array.map((base64String) =>
//     uploadBase64MediaToGCS(base64String, directory).catch((err) => {
//       console.error('❌ Skipped one media due to error:', err.message);
//       return null;
//     })
//   );

//   const results = await Promise.all(uploadPromises);
//   return results.filter(Boolean); // Remove any failed uploads
// };

// // ========================
// // 🔹 Exports
// // ========================
// export {
//   upload,
//   uploadBase64MediaToGCS,
//   uploadMultipleBase64MediaToGCS,
// };







// import multer from 'multer';
// import path from 'path';
// import { bucket } from './gcs-config.js';
// import sharp from 'sharp';
// import { v4 as uuidv4 } from 'uuid';

// const multerStorage = multer.memoryStorage(); // Store files in memory before processing

// const upload = multer({
//   storage: multerStorage,
//   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];

//     // Accept only allowed image types
//     if (!allowedMimeTypes.includes(file.mimetype)) {
//       return cb(new Error('Not an image! Please upload a valid image (JPEG, PNG, or GIF).'), false);
//     }

//     // Ensure file extension matches the mime type
//     const ext = path.extname(file.originalname).toLowerCase();
//     if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
//       return cb(new Error('Invalid file extension! Please upload a valid image file (JPG, PNG, or GIF).'), false);
//     }

//     cb(null, true);
//   },
// });


// // Function to handle a single image upload
// const uploadSingleImageToGCS = async (file, directory = 'users') => {
//   if (!file) return null;

//   const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, ''); // Clean filename
//   const newFileName = `${directory}/${uuidv4()}-${cleanFileName}`;
//   const blob = bucket.file(newFileName);
//   const blobStream = blob.createWriteStream({
//     resumable: false,
//     contentType: file.mimetype,
//     // predefinedAcl: 'publicRead',
//   });

//   return new Promise((resolve, reject) => {
//     const timeout = setTimeout(() => {
//       blobStream.destroy(new Error('Upload timed out'));
//     }, 15000); // Set timeout for 15s

//     sharp(file.buffer)
//       .resize(512) // Resize to a max width of 512px for user images
//       .jpeg({ quality: 80 }) // Set quality for jpeg
//       .toBuffer()
//       .then((optimizedBuffer) => {
//         blobStream.end(optimizedBuffer);
//       })
//       .catch((err) => {
//         clearTimeout(timeout);
//         console.error('Error during sharp processing:', err);
//         reject(err);
//       });

//     blobStream.on('finish', () => {
//       clearTimeout(timeout);
//       resolve(`https://storage.googleapis.com/${bucket.name}/${newFileName}`);
//     });

//     blobStream.on('error', (err) => {
//       clearTimeout(timeout);
//       console.error('Error during GCS upload:', err);
//       reject(err);
//     });
//   });
// };

// // Function to handle multiple image uploads
// const uploadMultipleImagesToGCS = async (files, directory = 'listings') => {
//   if (!files || files.length === 0) return [];

//   const uploadPromises = files.map((file) => {
//     const newFileName = `${directory}/${uuidv4()}-${file.originalname}`;
//     const blob = bucket.file(newFileName);
//     const blobStream = blob.createWriteStream({
//       resumable: false,
//       contentType: file.mimetype,
//       // predefinedAcl: 'publicRead',
//     });

//     return new Promise((resolve, reject) => {
//       sharp(file.buffer)
//         .resize(1024) // Resize to a max width of 1024px for listing images
//         .toBuffer()
//         .then((optimizedBuffer) => {
//           blobStream.end(optimizedBuffer);
//         })
//         .catch((err) => {
//           console.error('Error during sharp processing:', err);
//           reject(err);
//         });

//       blobStream.on('finish', () => {
//         resolve(`https://storage.googleapis.com/${bucket.name}/${newFileName}`);
//       });

//       blobStream.on('error', (err) => {
//         console.error('Error during GCS upload:', err);
//         reject(err);
//       });
//     });
//   });

//   return Promise.all(uploadPromises);
// };

// // Exporting upload methods
// export { upload, uploadSingleImageToGCS, uploadMultipleImagesToGCS };


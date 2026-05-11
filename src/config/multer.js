import multer from "multer";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { bucket } from "./gcs-config.js";
import { fileTypeFromBuffer } from "file-type";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";

// =======================================================
// 🔹 CONSTANTS
// =======================================================
const TMP_DIR = path.join(os.tmpdir(), "uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png"];
const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/mpeg",
];

// =======================================================
// 🔹 MULTER (DUAL MODE)
// =======================================================

// IMAGE → memory (fast)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype))
      return cb(new Error("Only JPEG/PNG allowed"), false);
    cb(null, true);
  },
});

// VIDEO → disk streaming (CRITICAL FIX)
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (_req, file, cb) =>
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO_MIME.includes(file.mimetype))
      return cb(new Error("Unsupported video format"), false);
    cb(null, true);
  },
});

// 🎯 Single middleware that auto-detects type
export const uploadMedia = (req, res, next) => {
  const type = req.headers["x-media-type"]; // image | video
  if (type === "video") return videoUpload.single("file")(req, res, next);
  return imageUpload.single("file")(req, res, next);
};

// =======================================================
// 🔹 HELPERS
// =======================================================
const sanitizeFileName = (name) =>
  name.replace(/[^a-zA-Z0-9\-_.]/g, "_").slice(0, 120);

const cleanupFile = (filePath) => {
  try { fs.unlinkSync(filePath); } catch {}
};

const uploadBufferToGCS = (buffer, blobPath, contentType) =>
  new Promise((resolve, reject) => {
    const blob = bucket.file(blobPath);
    const stream = blob.createWriteStream({
      resumable: false,
      contentType,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    stream.on("error", reject);
    stream.on("finish", resolve);
    stream.end(buffer);
  });

// =======================================================
// 🔹 IMAGE PIPELINE
// =======================================================
const compressImage = async (buffer, mimeType) => {
  const resized = sharp(buffer).resize({ width: 1024, withoutEnlargement: true });

  if (mimeType === "image/png") {
    const buf = await resized.png({ quality: 80 }).toBuffer();
    return { buffer: buf, mime: "image/png", ext: "png" };
  }

  const buf = await resized.jpeg({ quality: 80 }).toBuffer();
  return { buffer: buf, mime: "image/jpeg", ext: "jpg" };
};

const processImageUpload = async (file, directory) => {
  const detected = await fileTypeFromBuffer(file.buffer);
  const mime = detected?.mime || file.mimetype;

  const { buffer, mime: finalMime, ext } = await compressImage(file.buffer, mime);
  const fileName = `${directory}/${uuidv4()}.${ext}`;

  await uploadBufferToGCS(buffer, fileName, finalMime);

  return {
    mediaType: "image",
    url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
    sizeKB: Number((buffer.length / 1024).toFixed(2)),
  };
};

// =======================================================
// 🔹 VIDEO → HLS PIPELINE
// =======================================================
const convertAndUploadHLS = async (filePath, directory) => {
  const sessionId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), `hls_${sessionId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const outputM3u8 = path.join(tmpDir, "index.m3u8");

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        "-codec:v libx264",
        "-codec:a aac",
        "-vf scale=-2:720",
        "-hls_time 6",
        "-hls_playlist_type vod",
        "-hls_segment_filename", path.join(tmpDir, "seg%04d.ts"),
      ])
      .output(outputM3u8)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  const gcsPrefix = `${directory}/${sessionId}`;
  const files = fs.readdirSync(tmpDir);

  await Promise.all(
    files.map((f) => {
      const buffer = fs.readFileSync(path.join(tmpDir, f));
      const type = f.endsWith(".m3u8") ? "application/x-mpegurl" : "video/MP2T";
      return uploadBufferToGCS(buffer, `${gcsPrefix}/${f}`, type);
    })
  );

  cleanupFile(filePath);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return {
    mediaType: "video",
    url: `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/index.m3u8`,
  };
};

// =======================================================
// 🚀 MAIN ENTRY FUNCTION (single function)
// =======================================================
export const uploadMediaToGCS = async (file, directory = "uploads") => {
  if (!file) throw new Error("No file uploaded");

  // IMAGE
  if (file.buffer) {
    return processImageUpload(file, directory);
  }

  // VIDEO
  if (file.path) {
    return convertAndUploadHLS(file.path, directory);
  }

  throw new Error("Unsupported upload type");
};



















// import multer from 'multer';
// import path from 'path';
// import sharp from 'sharp';
// import { v4 as uuidv4 } from 'uuid';
// import { bucket } from './gcs-config.js';
// import { fileTypeFromBuffer } from 'file-type';
// import ffmpeg from 'fluent-ffmpeg';
// import fs from 'fs';
// import os from 'os';

// // ========================
// // 🔹 Allowed Types
// // ========================
// const ALLOWED_IMAGE_MIME  = ['image/jpeg', 'image/png'];
// const ALLOWED_IMAGE_EXT   = ['.jpg', '.jpeg', '.png'];
// const ALLOWED_VIDEO_MIME  = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg', 'application/x-mpegurl'];
// const ALLOWED_VIDEO_EXT   = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg', '.m3u8', '.ts'];

// // ========================
// // 🔹 Multer Configuration
// // ========================
// const multerStorage = multer.memoryStorage();

// export const upload = multer({
//   storage: multerStorage,
//   limits: { fileSize: 500 * 1024 * 1024 },
//   fileFilter: (_req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();

//     const isImage = ALLOWED_IMAGE_MIME.includes(file.mimetype) && ALLOWED_IMAGE_EXT.includes(ext);
//     const isVideo = ALLOWED_VIDEO_MIME.includes(file.mimetype) && ALLOWED_VIDEO_EXT.includes(ext);

//     if (!isImage && !isVideo) {
//       return cb(new Error('Invalid file. Allowed: JPEG/PNG images or MP4/MOV/AVI/WEBM videos.'), false);
//     }
//     cb(null, true);
//   },
// });

// // ========================
// // 🔹 Helpers
// // ========================
// const sanitizeFileName = (name) =>
//   name.replace(/[^a-zA-Z0-9\-_.]/g, '_').slice(0, 120);

// const bufferToTempFile = (buffer, ext) => {
//   const tmpPath = path.join(os.tmpdir(), `${uuidv4()}${ext}`);
//   fs.writeFileSync(tmpPath, buffer);
//   return tmpPath;
// };

// const cleanupFile = (filePath) => {
//   try { fs.unlinkSync(filePath); } catch { /* ignore */ }
// };

// const cleanupDir = (dirPath) => {
//   try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch { /* ignore */ }
// };

// // ========================
// // 🔹 Image Compression
// // ========================
// const compressImage = async (buffer, mimeType) => {
//   const resized = sharp(buffer).resize({ width: 1024, withoutEnlargement: true });

//   if (mimeType === 'image/png') {
//     const compressed = await resized.png({ quality: 80 }).toBuffer();
//     return { buffer: compressed, mimeType: 'image/png', extension: 'png' };
//   }

//   const compressed = await resized.jpeg({ quality: 80 }).toBuffer();
//   return { buffer: compressed, mimeType: 'image/jpeg', extension: 'jpg' };
// };

// // ========================
// // 🔹 HLS Video Conversion
// // ========================
// const convertAndUploadHLS = async (buffer, mimeType, directory) => {
//   const sessionId  = uuidv4();
//   const tmpDir     = path.join(os.tmpdir(), `hls_${sessionId}`);
//   fs.mkdirSync(tmpDir, { recursive: true });

//   const inputExt   = mimeType === 'application/x-mpegurl' ? '.m3u8' : '.mp4';
//   const inputPath  = bufferToTempFile(buffer, inputExt);
//   const outputM3u8 = path.join(tmpDir, 'index.m3u8');

//   try {
//     if (mimeType === 'application/x-mpegurl' || inputExt === '.m3u8') {
//       const gcsPrefix  = sanitizeFileName(`${directory}/${sessionId}`);
//       const blobName   = `${gcsPrefix}/index.m3u8`;
//       await uploadBufferToGCS(buffer, blobName, 'application/x-mpegurl');
//       return {
//         playlistUrl: `https://storage.googleapis.com/${bucket.name}/${blobName}`,
//         fileName:    blobName,
//         durationSec: null,
//       };
//     }

//     let probedDuration = null;

//     await new Promise((resolve, reject) => {
//       ffmpeg(inputPath)
//         .outputOptions([
//           '-codec:v libx264',
//           '-codec:a aac',
//           '-b:v 1500k',
//           '-b:a 128k',
//           '-vf scale=-2:720',
//           '-hls_time 6',
//           '-hls_playlist_type vod',
//           '-hls_segment_filename',
//           path.join(tmpDir, 'seg%04d.ts'),
//           '-start_number 0',
//         ])
//         .output(outputM3u8)
//         .on('codecData', (data) => {
//           const match = data.duration?.match(/(\d+):(\d+):(\d+)/);
//           if (match) {
//             probedDuration =
//               parseInt(match[1]) * 3600 +
//               parseInt(match[2]) * 60  +
//               parseInt(match[3]);
//           }
//         })
//         .on('end', resolve)
//         .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
//         .run();
//     });

//     const gcsPrefix  = sanitizeFileName(`${directory}/${sessionId}`);
//     const hlsFiles   = fs.readdirSync(tmpDir);

//     await Promise.all(
//       hlsFiles.map((file) => {
//         const filePath    = path.join(tmpDir, file);
//         const fileBuffer  = fs.readFileSync(filePath);
//         const gcsPath     = `${gcsPrefix}/${file}`;
//         const contentType = file.endsWith('.m3u8')
//           ? 'application/x-mpegurl'
//           : 'video/MP2T';
//         return uploadBufferToGCS(fileBuffer, gcsPath, contentType);
//       })
//     );

//     const playlistUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/index.m3u8`;
//     return { playlistUrl, fileName: `${gcsPrefix}/index.m3u8`, durationSec: probedDuration };

//   } finally {
//     cleanupFile(inputPath);
//     cleanupDir(tmpDir);
//   }
// };

// // ========================
// // 🔹 Low-level GCS Helper
// // ========================
// const uploadBufferToGCS = (buffer, blobPath, contentType) =>
//   new Promise((resolve, reject) => {
//     const blob       = bucket.file(blobPath);
//     const blobStream = blob.createWriteStream({
//       resumable:   false,
//       contentType,
//       metadata:    { cacheControl: 'public, max-age=31536000' },
//     });
//     blobStream.on('error', reject);
//     blobStream.on('finish', resolve);
//     blobStream.end(buffer);
//   });

// // ========================
// // 🔹 Main Upload Dispatcher
// // ========================
// export const uploadMediaToGCS = async (input, directory = 'uploads') => {
//   const startTime = Date.now();
//   let mimeType;
//   let buffer;

//   if (typeof input === 'string') {
//     const matches = input.match(/^data:(.+);base64,(.+)$/);
//     if (!matches) throw new Error('Invalid Base64 format');
//     mimeType = matches[1];
//     buffer   = Buffer.from(matches[2], 'base64');
//   } else if (input?.buffer && input?.mimetype) {
//     mimeType = input.mimetype;
//     buffer   = input.buffer;
//   } else {
//     throw new Error('Unsupported input: pass a base64 string or a Multer file object.');
//   }

//   const detected = await fileTypeFromBuffer(buffer);
//   if (detected?.mime) mimeType = detected.mime;

//   const isImage = mimeType.startsWith('image/');
//   const isVideo = mimeType.startsWith('video/') || mimeType === 'application/x-mpegurl';

//   if (isImage) {
//     if (!['image/jpeg', 'image/png'].includes(mimeType)) {
//       throw new Error('Only JPEG and PNG images are accepted.');
//     }

//     const { buffer: finalBuf, mimeType: finalMime, extension } =
//       await compressImage(buffer, mimeType);

//     const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${extension}`);
//     await uploadBufferToGCS(finalBuf, fileName, finalMime);

//     return {
//       url:          `https://storage.googleapis.com/${bucket.name}/${fileName}`,
//       fileName,
//       mediaType:    'image',
//       sizeKB:       Number((finalBuf.length / 1024).toFixed(2)),
//       uploadTimeMS: Date.now() - startTime,
//       durationSec:  null,
//     };
//   }

//   if (isVideo) {
//     const { playlistUrl, fileName, durationSec } =
//       await convertAndUploadHLS(buffer, mimeType, directory);

//     return {
//       url:          playlistUrl,
//       fileName,
//       mediaType:    'video',
//       sizeKB:       Number((buffer.length / 1024).toFixed(2)),
//       uploadTimeMS: Date.now() - startTime,
//       durationSec,
//     };
//   }

//   throw new Error(`Unsupported media type: ${mimeType}`);
// };

// // ========================
// // 🔹 Backward Compat
// // ========================
// export const uploadBase64MediaToGCS = (base64, directory = 'uploads') =>
//   uploadMediaToGCS(base64, directory);



















// import multer from 'multer';
// import path from 'path';
// import sharp from 'sharp';
// import { v4 as uuidv4 } from 'uuid';
// import { bucket } from './gcs-config.js';
// import pkg from 'file-type';
// import ffmpeg from 'fluent-ffmpeg';
// import ffmpegStatic from 'ffmpeg-static';
// import fs from 'fs';
// import os from 'os';

// const { fileTypeFromBuffer } = pkg;

// // Point fluent-ffmpeg at the bundled static binary
// ffmpeg.setFfmpegPath(ffmpegStatic);

// // ========================
// // 🔹 Allowed Types
// // ========================
// const ALLOWED_IMAGE_MIME  = ['image/jpeg', 'image/png'];
// const ALLOWED_IMAGE_EXT   = ['.jpg', '.jpeg', '.png'];
// const ALLOWED_VIDEO_MIME  = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg', 'application/x-mpegurl'];
// const ALLOWED_VIDEO_EXT   = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg', '.m3u8', '.ts'];

// // ========================
// // 🔹 Multer Configuration
// // ========================
// const multerStorage = multer.memoryStorage();

// /**
//  * Accept images (JPEG, PNG) AND videos (mp4, mov, avi, webm, m3u8…).
//  * Route handlers decide which field name to use.
//  */
// export const upload = multer({
//   storage: multerStorage,
//   limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB (videos can be large)
//   fileFilter: (_req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();

//     const isImage = ALLOWED_IMAGE_MIME.includes(file.mimetype) && ALLOWED_IMAGE_EXT.includes(ext);
//     const isVideo = ALLOWED_VIDEO_MIME.includes(file.mimetype) && ALLOWED_VIDEO_EXT.includes(ext);

//     if (!isImage && !isVideo) {
//       return cb(new Error('Invalid file. Allowed: JPEG/PNG images or MP4/MOV/AVI/WEBM videos.'), false);
//     }
//     cb(null, true);
//   },
// });

// // ========================
// // 🔹 Helpers
// // ========================
// const sanitizeFileName = (name) =>
//   name.replace(/[^a-zA-Z0-9\-_.]/g, '_').slice(0, 120);

// /** Write a buffer to a temp file and return its path. */
// const bufferToTempFile = (buffer, ext) => {
//   const tmpPath = path.join(os.tmpdir(), `${uuidv4()}${ext}`);
//   fs.writeFileSync(tmpPath, buffer);
//   return tmpPath;
// };

// /** Delete a file silently (best-effort cleanup). */
// const cleanupFile = (filePath) => {
//   try { fs.unlinkSync(filePath); } catch { /* ignore */ }
// };

// /** Delete a whole directory silently. */
// const cleanupDir = (dirPath) => {
//   try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch { /* ignore */ }
// };

// // ========================
// // 🔹 Image Compression
// // ========================
// /**
//  * Compress JPEG or PNG with Sharp.
//  * Returns { buffer, mimeType, extension }.
//  */
// const compressImage = async (buffer, mimeType) => {
//   const resized = sharp(buffer).resize({ width: 1024, withoutEnlargement: true });

//   if (mimeType === 'image/png') {
//     const compressed = await resized.png({ quality: 80 }).toBuffer();
//     return { buffer: compressed, mimeType: 'image/png', extension: 'png' };
//   }

//   // JPEG (default)
//   const compressed = await resized.jpeg({ quality: 80 }).toBuffer();
//   return { buffer: compressed, mimeType: 'image/jpeg', extension: 'jpg' };
// };

// // ========================
// // 🔹 HLS Video Conversion
// // ========================
// /**
//  * Convert any video buffer to HLS (.m3u8 + .ts segments).
//  * If the file is already an m3u8/HLS playlist it is uploaded as-is.
//  *
//  * @param {Buffer}  buffer       Raw video buffer
//  * @param {string}  mimeType     Detected MIME type
//  * @param {string}  directory    GCS destination folder
//  * @returns {Promise<{ playlistUrl: string, fileName: string, durationSec: number|null }>}
//  */
// const convertAndUploadHLS = async (buffer, mimeType, directory) => {
//   const sessionId  = uuidv4();
//   const tmpDir     = path.join(os.tmpdir(), `hls_${sessionId}`);
//   fs.mkdirSync(tmpDir, { recursive: true });

//   // Determine source extension for the temp input file
//   const inputExt   = mimeType === 'application/x-mpegurl' ? '.m3u8' : '.mp4';
//   const inputPath  = bufferToTempFile(buffer, inputExt);
//   const outputM3u8 = path.join(tmpDir, 'index.m3u8');

//   try {
//     // ── If already HLS playlist, skip re-encoding ──────────────────────────
//     if (mimeType === 'application/x-mpegurl' || inputExt === '.m3u8') {
//       // Upload the playlist + any .ts files bundled in the same buffer
//       // (single-buffer HLS is unusual; we just upload the manifest as-is)
//       const gcsPrefix  = sanitizeFileName(`${directory}/${sessionId}`);
//       const blobName   = `${gcsPrefix}/index.m3u8`;
//       await uploadBufferToGCS(buffer, blobName, 'application/x-mpegurl');
//       return {
//         playlistUrl: `https://storage.googleapis.com/${bucket.name}/${blobName}`,
//         fileName:    blobName,
//         durationSec: null,
//       };
//     }

//     // ── Convert to HLS with ffmpeg ──────────────────────────────────────────
//     let probedDuration = null;

//     await new Promise((resolve, reject) => {
//       ffmpeg(inputPath)
//         .outputOptions([
//           '-codec:v libx264',          // H.264 video codec
//           '-codec:a aac',              // AAC audio
//           '-b:v 1500k',                // video bitrate
//           '-b:a 128k',                 // audio bitrate
//           '-vf scale=-2:720',          // scale to 720p (keeps aspect ratio)
//           '-hls_time 6',               // 6-second segments
//           '-hls_playlist_type vod',    // VOD playlist
//           '-hls_segment_filename',
//           path.join(tmpDir, 'seg%04d.ts'),
//           '-start_number 0',
//         ])
//         .output(outputM3u8)
//         .on('codecData', (data) => {
//           // Try to parse duration from codec metadata
//           const match = data.duration?.match(/(\d+):(\d+):(\d+)/);
//           if (match) {
//             probedDuration =
//               parseInt(match[1]) * 3600 +
//               parseInt(match[2]) * 60  +
//               parseInt(match[3]);
//           }
//         })
//         .on('end', resolve)
//         .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
//         .run();
//     });

//     // ── Upload all generated files to GCS ─────────────────────────────────
//     const gcsPrefix  = sanitizeFileName(`${directory}/${sessionId}`);
//     const hlsFiles   = fs.readdirSync(tmpDir);

//     await Promise.all(
//       hlsFiles.map((file) => {
//         const filePath    = path.join(tmpDir, file);
//         const fileBuffer  = fs.readFileSync(filePath);
//         const gcsPath     = `${gcsPrefix}/${file}`;
//         const contentType = file.endsWith('.m3u8')
//           ? 'application/x-mpegurl'
//           : 'video/MP2T';
//         return uploadBufferToGCS(fileBuffer, gcsPath, contentType);
//       })
//     );

//     const playlistUrl = `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/index.m3u8`;
//     return { playlistUrl, fileName: `${gcsPrefix}/index.m3u8`, durationSec: probedDuration };

//   } finally {
//     cleanupFile(inputPath);
//     cleanupDir(tmpDir);
//   }
// };

// // ========================
// // 🔹 Low-level GCS Helper
// // ========================
// /**
//  * Upload a single buffer to GCS under the given blob path.
//  */
// const uploadBufferToGCS = (buffer, blobPath, contentType) =>
//   new Promise((resolve, reject) => {
//     const blob       = bucket.file(blobPath);
//     const blobStream = blob.createWriteStream({
//       resumable:   false,
//       contentType,
//       metadata:    { cacheControl: 'public, max-age=31536000' },
//     });
//     blobStream.on('error', reject);
//     blobStream.on('finish', resolve);
//     blobStream.end(buffer);
//   });

// // ========================
// // 🔹 Main Upload Dispatcher
// // ========================
// /**
//  * Smart upload:
//  *  - Images  → compressed JPEG/PNG → GCS
//  *  - Videos  → HLS conversion if needed → GCS (returns m3u8 URL)
//  *
//  * @param {string|object} input      Base64 string or Multer file object
//  * @param {string}        directory  GCS folder  (e.g. 'videos', 'avatars')
//  * @returns {Promise<{
//  *   url:         string,       // Public GCS URL
//  *   fileName:    string,       // GCS blob path
//  *   mediaType:  'image'|'video',
//  *   sizeKB:      number,
//  *   uploadTimeMS:number,
//  *   durationSec: number|null,  // Only for videos
//  * }>}
//  */
// export const uploadMediaToGCS = async (input, directory = 'uploads') => {
//   const startTime = Date.now();
//   let mimeType;
//   let buffer;

//   // ── Normalise input ───────────────────────────────────────────────────────
//   if (typeof input === 'string') {
//     const matches = input.match(/^data:(.+);base64,(.+)$/);
//     if (!matches) throw new Error('Invalid Base64 format');
//     mimeType = matches[1];
//     buffer   = Buffer.from(matches[2], 'base64');
//   } else if (input?.buffer && input?.mimetype) {
//     mimeType = input.mimetype;
//     buffer   = input.buffer;
//   } else {
//     throw new Error('Unsupported input: pass a base64 string or a Multer file object.');
//   }

//   // ── Real MIME detection from bytes ────────────────────────────────────────
//   const detected = await fileTypeFromBuffer(buffer);
//   if (detected?.mime) mimeType = detected.mime;

//   const isImage = mimeType.startsWith('image/');
//   const isVideo = mimeType.startsWith('video/') || mimeType === 'application/x-mpegurl';

//   // ── Route to handler ─────────────────────────────────────────────────────
//   if (isImage) {
//     // Reject GIF at this stage (not in allowed list)
//     if (!['image/jpeg', 'image/png'].includes(mimeType)) {
//       throw new Error('Only JPEG and PNG images are accepted.');
//     }

//     const { buffer: finalBuf, mimeType: finalMime, extension } =
//       await compressImage(buffer, mimeType);

//     const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${extension}`);
//     await uploadBufferToGCS(finalBuf, fileName, finalMime);

//     return {
//       url:          `https://storage.googleapis.com/${bucket.name}/${fileName}`,
//       fileName,
//       mediaType:    'image',
//       sizeKB:       Number((finalBuf.length / 1024).toFixed(2)),
//       uploadTimeMS: Date.now() - startTime,
//       durationSec:  null,
//     };
//   }

//   if (isVideo) {
//     const { playlistUrl, fileName, durationSec } =
//       await convertAndUploadHLS(buffer, mimeType, directory);

//     return {
//       url:          playlistUrl,
//       fileName,
//       mediaType:    'video',
//       sizeKB:       Number((buffer.length / 1024).toFixed(2)),
//       uploadTimeMS: Date.now() - startTime,
//       durationSec,
//     };
//   }

//   throw new Error(`Unsupported media type: ${mimeType}`);
// };

// // ========================
// // 🔹 Backward Compat
// // ========================
// export const uploadBase64MediaToGCS = (base64, directory = 'uploads') =>
//   uploadMediaToGCS(base64, directory);






























// import multer from 'multer';
// import path from 'path';
// import sharp from 'sharp';
// import { v4 as uuidv4 } from 'uuid';
// import { bucket } from './gcs-config.js';
// import pkg from 'file-type';
// const { fileTypeFromBuffer } = pkg;

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
// // 🔹 Compress Image by MIME Type
// // ========================
// /**
//  * Compresses an image buffer while preserving format-specific features.
//  * - JPEG → compressed JPEG
//  * - PNG  → compressed PNG (preserves transparency)
//  * - GIF  → returned as-is (Sharp doesn't support animated GIFs)
//  *
//  * @param {Buffer} buffer - Raw image buffer
//  * @param {string} mimeType - Detected MIME type
//  * @returns {Promise<{ buffer: Buffer, mimeType: string, extension: string }>}
//  */
// const compressImage = async (buffer, mimeType) => {
//   const sharpInstance = sharp(buffer).resize({ width: 1024, withoutEnlargement: true });

//   if (mimeType === 'image/png') {
//     const compressed = await sharpInstance.png({ quality: 80 }).toBuffer();
//     return { buffer: compressed, mimeType: 'image/png', extension: 'png' };
//   }

//   if (mimeType === 'image/gif') {
//     // Skip compression — Sharp does not support animated GIFs
//     return { buffer, mimeType: 'image/gif', extension: 'gif' };
//   }

//   // Default: JPEG
//   const compressed = await sharpInstance.jpeg({ quality: 80 }).toBuffer();
//   return { buffer: compressed, mimeType: 'image/jpeg', extension: 'jpg' };
// };

// // ========================
// // 🔹 Hybrid Upload to GCS
// // ========================
// /**
//  * Upload Base64 *or* Multer file buffer to Google Cloud Storage.
//  * Automatically detects the input type and compresses images.
//  *
//  * @param {string|object} input - Base64 string or Multer file object
//  * @param {string} directory - Folder in bucket (e.g., 'users', 'listings')
//  * @returns {Promise<{ url: string, fileName: string, sizeKB: number, uploadTimeMS: number }>}
//  */
// const uploadMediaToGCS = async (input, directory = 'logoUploads') => {
//   const startTime = Date.now();
//   let mimeType;
//   let buffer;

//   try {
//     // 🧩 1️⃣ Base64 Input
//     if (typeof input === 'string') {
//       const matches = input.match(/^data:(.+);base64,(.+)$/);
//       if (!matches) throw new Error('Invalid Base64 format');
//       mimeType = matches[1];
//       buffer = Buffer.from(matches[2], 'base64');
//     }
//     // 🧩 2️⃣ Multer File Input
//     else if (input?.buffer && input?.mimetype) {
//       mimeType = input.mimetype;
//       buffer = input.buffer;
//     } else {
//       throw new Error('Unsupported input type');
//     }

//     // 🧠 Detect and validate real MIME type from buffer bytes
//     const detectedType = await fileTypeFromBuffer(buffer);
//     if (detectedType?.mime) mimeType = detectedType.mime;

//     // ✅ Compress image and resolve final mimeType + extension AFTER compression
//     let finalBuffer = buffer;
//     let finalMimeType = mimeType;
//     let finalExtension = mimeType.split('/')[1] || 'bin';

//     if (mimeType.startsWith('image/')) {
//       try {
//         const result = await compressImage(buffer, mimeType);
//         finalBuffer = result.buffer;
//         finalMimeType = result.mimeType;
//         finalExtension = result.extension;
//       } catch (err) {
//         console.warn('⚠️ Sharp compression failed, uploading raw buffer:', err.message);
//       }
//     }

//     // 🗂️ Build file name using the correct post-compression extension
//     const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${finalExtension}`);
//     const blob = bucket.file(fileName);

//     // ✅ Upload to GCS
//     await new Promise((resolve, reject) => {
//       const blobStream = blob.createWriteStream({
//         resumable: false,
//         contentType: finalMimeType,
//         metadata: { cacheControl: 'public, max-age=31536000' },
//       });
//       blobStream.on('error', reject);
//       blobStream.on('finish', resolve);
//       blobStream.end(finalBuffer);
//     });

//     const uploadTimeMS = Date.now() - startTime;
//     const sizeKB = (finalBuffer.length / 1024).toFixed(2);

//     console.log(`✅ Uploaded ${fileName} [${sizeKB} KB, ${uploadTimeMS} ms]`);

//     return {
//       url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
//       fileName,
//       sizeKB: Number(sizeKB),
//       uploadTimeMS,
//     };
//   } catch (error) {
//     console.error('❌ Upload failed:', error);
//     throw new Error('Failed to upload media to GCS');
//   }
// };

// // ========================
// // 🔹 Multiple Uploads (Hybrid)
// // ========================
// /**
//  * Upload an array of Base64 strings or Multer file objects.
//  * Failed items are skipped and logged rather than failing the whole batch.
//  *
//  * @param {Array<string|object>} inputs - Array of Base64 strings or Multer file objects
//  * @param {string} directory - Folder in bucket
//  * @returns {Promise<Array<{ url: string, fileName: string, sizeKB: number, uploadTimeMS: number }>>}
//  */


// // ========================
// // 🔹 Backward Compatibility
// // ========================
// const uploadBase64MediaToGCS = async (base64String, directory = 'logoUploads') =>
//   uploadMediaToGCS(base64String, directory);

// // const uploadMultipleBase64MediaToGCS = async (base64Array, directory = 'uploads') =>
// //   uploadMultipleMediaToGCS(base64Array, directory);

// // ========================
// // 🔹 Exports
// // ========================
// export {
//   upload,                        // Multer middleware
//   uploadMediaToGCS,              // Hybrid single upload handler
//   // uploadMultipleMediaToGCS,      // Hybrid multiple upload handler
//   uploadBase64MediaToGCS,        // Backward compatibility (single)
//   // uploadMultipleBase64MediaToGCS // Backward compatibility (multiple)
// };
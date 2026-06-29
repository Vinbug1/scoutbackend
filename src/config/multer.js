import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { bucket } from './gcs-config.js';
import { fileTypeFromBuffer } from 'file-type';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';

// ========================
// 🔹 Allowed Types
// ========================
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png'];
const ALLOWED_IMAGE_EXT  = ['.jpg', '.jpeg', '.png'];
const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg', 'application/x-mpegurl'];
const ALLOWED_VIDEO_EXT  = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg', '.m3u8', '.ts'];

// ========================
// 🔹 Multer Configuration
// FIX: Use diskStorage instead of memoryStorage.
//      memoryStorage holds the entire file in RAM — for 500 MB videos
//      over slow/mobile connections the client times out mid-stream and
//      multer throws "Request aborted". Streaming to disk avoids that.
// ========================
const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename:    (_req, _file, cb) =>
    cb(null, `${uuidv4()}${path.extname(_file.originalname).toLowerCase()}`),
});

export const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 500 * 1024 * 1024 },  // 500 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const isImage = ALLOWED_IMAGE_MIME.includes(file.mimetype) && ALLOWED_IMAGE_EXT.includes(ext);
    const isVideo = ALLOWED_VIDEO_MIME.includes(file.mimetype) && ALLOWED_VIDEO_EXT.includes(ext);

    if (!isImage && !isVideo) {
      return cb(new Error('Invalid file. Allowed: JPEG/PNG images or MP4/MOV/AVI/WEBM videos.'), false);
    }
    cb(null, true);
  },
});

// ========================
// 🔹 Named Field Uploads
// FIX: Wrap in a factory so the route can use the callback form and
//      catch multer errors instead of letting them propagate unhandled.
// ========================
export const uploadVideoWithThumbnail = upload.fields([
  { name: 'video',     maxCount: 1 },   // required — must be a video
  { name: 'thumbnail', maxCount: 1 },   // optional — must be JPEG/PNG
]);

/**
 * Express middleware wrapper for uploadVideoWithThumbnail.
 * Use this in your route so multer errors are handled gracefully:
 *
 *   router.post('/upload', handleUploadFields, async (req, res) => { ... });
 */
export const handleUploadFields = (req, res, next) => {
  // FIX: Increase socket timeout for long video uploads.
  req.setTimeout(10 * 60 * 1000);   // 10 minutes
  res.setTimeout(10 * 60 * 1000);

  // FIX: Clean up any disk files if the client disconnects mid-upload.
  req.on('close', () => {
    if (!res.writableEnded) {
      const files = Object.values(req.files || {}).flat();
      files.forEach((f) => f.path && cleanupFile(f.path));
    }
  });

  uploadVideoWithThumbnail(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// ========================
// 🔹 Helpers
// ========================
const sanitizeFileName = (name) =>
  name.replace(/[^a-zA-Z0-9\-_.]/g, '_').slice(0, 120);

/**
 * Write a buffer to a temp file and return the path.
 * Only used for base64 inputs — multer disk uploads already have a path.
 */
const bufferToTempFile = (buffer, ext) => {
  const tmpPath = path.join(os.tmpdir(), `${uuidv4()}${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
};

const cleanupFile = (filePath) => {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
};

const cleanupDir = (dirPath) => {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch { /* ignore */ }
};

// ========================
// 🔹 Image Compression
// ========================
const compressImage = async (buffer, mimeType) => {
  const resized = sharp(buffer).resize({ width: 1024, withoutEnlargement: true });

  if (mimeType === 'image/png') {
    const compressed = await resized.png({ quality: 80 }).toBuffer();
    return { buffer: compressed, mimeType: 'image/png', extension: 'png' };
  }

  const compressed = await resized.jpeg({ quality: 80 }).toBuffer();
  return { buffer: compressed, mimeType: 'image/jpeg', extension: 'jpg' };
};

// ========================
// 🔹 FFmpeg Rendition Encoder
// FIX: Encode renditions sequentially instead of concurrently via
//      Promise.all. Parallel encoding of a 500 MB file at 4 renditions
//      simultaneously can spike to 2 GB+ of temp data and saturate CPU,
//      causing timeouts. Sequential is slower but stable.
// ========================
const renditions = [
  { label: '1080p', height: 1080, videoBitrate: '4500k', audioBitrate: '192k' },
  { label: '720p',  height: 720,  videoBitrate: '2800k', audioBitrate: '128k' },
  { label: '480p',  height: 480,  videoBitrate: '1400k', audioBitrate: '128k' },
  { label: '360p',  height: 360,  videoBitrate:  '800k', audioBitrate:  '96k' },
];

const encodeRendition = (inputPath, tmpDir, { label, height, videoBitrate, audioBitrate }) => {
  const rendDir = path.join(tmpDir, label);
  fs.mkdirSync(rendDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(path.join(rendDir, 'index.m3u8'))
      .outputOptions([
        '-codec:v libx264',
        '-codec:a aac',
        `-b:v ${videoBitrate}`,
        `-b:a ${audioBitrate}`,
        `-vf scale=-2:${height}`,
        '-hls_time 2',
        '-hls_playlist_type vod',
        '-hls_segment_filename', path.join(rendDir, 'seg%04d.ts'),
        '-start_number 0',
      ])
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`FFmpeg [${label}] error: ${err.message}`)))
      .run();
  });
};

// ========================
// 🔹 HLS Video Conversion
// ========================
const convertAndUploadHLS = async (inputPath, mimeType, directory) => {
  // inputPath is now always a disk path (multer diskStorage or bufferToTempFile).
  const sessionId    = uuidv4();
  const tmpDir       = path.join(os.tmpdir(), `hls_${sessionId}`);
  const outputThumb  = path.join(tmpDir, 'thumbnail.jpg');
  fs.mkdirSync(tmpDir, { recursive: true });

  // ── Passthrough: already an HLS stream ────────────────────────────────────
  if (mimeType === 'application/x-mpegurl') {
    const gcsPrefix = sanitizeFileName(`${directory}/${sessionId}`);
    const blobName  = `${gcsPrefix}/index.m3u8`;
    const buffer    = fs.readFileSync(inputPath);
    await uploadBufferToGCS(buffer, blobName, 'application/x-mpegurl');
    return {
      masterUrl:    `https://storage.googleapis.com/${bucket.name}/${blobName}`,
      thumbnailUrl: null,
      fileName:     blobName,
      durationSec:  null,
    };
  }

  let probedDuration = null;

  try {
    // ── Step 1: Probe duration ───────────────────────────────────────────────
    // Probe separately so we have the duration before encoding starts.
    await new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (!err && metadata?.format?.duration) {
          probedDuration = Math.round(metadata.format.duration);
        }
        resolve(); // never reject — duration is optional
      });
    });

    // ── Step 2: Encode renditions sequentially ───────────────────────────────
    for (const rendition of renditions) {
      await encodeRendition(inputPath, tmpDir, rendition);
    }

    // ── Step 3: Build the master playlist ────────────────────────────────────
    const bandwidthMap = {
      '1080p': 4500000,
      '720p':  2800000,
      '480p':  1400000,
      '360p':   800000,
    };
    const resolutionMap = {
      '1080p': '1920x1080',
      '720p':  '1280x720',
      '480p':  '854x480',
      '360p':  '640x360',
    };

    const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3', ''];
    for (const { label } of renditions) {
      masterLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthMap[label]},RESOLUTION=${resolutionMap[label]}`,
        `${label}/index.m3u8`,
        ''
      );
    }
    const masterPlaylistPath = path.join(tmpDir, 'master.m3u8');
    fs.writeFileSync(masterPlaylistPath, masterLines.join('\n'));

    // ── Step 4: Extract thumbnail ─────────────────────────────────────────────
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({ timestamps: ['00:00:01'], filename: 'thumbnail.jpg', folder: tmpDir, size: '1024x?' })
        .on('end', resolve)
        .on('error', () => {
          // Fallback to frame 0 for very short clips
          ffmpeg(inputPath)
            .screenshots({ timestamps: ['00:00:00'], filename: 'thumbnail.jpg', folder: tmpDir, size: '1024x?' })
            .on('end', resolve)
            .on('error', reject);
        });
    });

    const rawThumb = fs.readFileSync(outputThumb);
    const { buffer: compressedThumb } = await compressImage(rawThumb, 'image/jpeg');

    // ── Step 5: Upload everything to GCS ─────────────────────────────────────
    const gcsPrefix    = sanitizeFileName(`${directory}/${sessionId}`);
    const uploadTasks  = [];

    // Master playlist
    uploadTasks.push(
      uploadBufferToGCS(
        fs.readFileSync(masterPlaylistPath),
        `${gcsPrefix}/master.m3u8`,
        'application/x-mpegurl'
      )
    );

    // Per-rendition HLS files
    for (const { label } of renditions) {
      const rendDir = path.join(tmpDir, label);
      for (const file of fs.readdirSync(rendDir)) {
        const fileBuffer  = fs.readFileSync(path.join(rendDir, file));
        const gcsPath     = `${gcsPrefix}/${label}/${file}`;
        const contentType = file.endsWith('.m3u8') ? 'application/x-mpegurl' : 'video/MP2T';
        uploadTasks.push(uploadBufferToGCS(fileBuffer, gcsPath, contentType));
      }
    }

    // Thumbnail
    uploadTasks.push(
      uploadBufferToGCS(compressedThumb, `${gcsPrefix}/thumbnail.jpg`, 'image/jpeg')
    );

    await Promise.all(uploadTasks);

    return {
      masterUrl:    `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/master.m3u8`,
      thumbnailUrl: `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/thumbnail.jpg`,
      fileName:     `${gcsPrefix}/master.m3u8`,
      durationSec:  probedDuration,
    };

  } finally {
    cleanupDir(tmpDir);
    // NOTE: inputPath itself is NOT cleaned up here.
    // • If it came from multer diskStorage, the route should delete req.file.path after the response.
    // • If it came from bufferToTempFile (base64 path), uploadMediaToGCS cleans it up.
  }
};

// ========================
// 🔹 Low-level GCS Helper
// ========================
const uploadBufferToGCS = (buffer, blobPath, contentType) =>
  new Promise((resolve, reject) => {
    const blob       = bucket.file(blobPath);
    const blobStream = blob.createWriteStream({
      resumable:   false,
      contentType,
      metadata:    { cacheControl: 'public, max-age=31536000' },
    });
    blobStream.on('error', reject);
    blobStream.on('finish', resolve);
    blobStream.end(buffer);
  });

// ========================
// 🔹 Main Upload Dispatcher
// ========================
/**
 * Accepts either:
 *   • A base64 data-URI string  →  "data:<mime>;base64,<data>"
 *   • A Multer file object      →  { path, mimetype, originalname, ... }
 *                                  (diskStorage — has .path, not .buffer)
 *
 * @param {string|object} input
 * @param {string}        directory  GCS folder prefix (default: 'uploads')
 */
export const uploadMediaToGCS = async (input, directory = 'uploads') => {
  const startTime = Date.now();
  let mimeType;
  let inputPath;          // disk path we'll hand to converters
  let isTemporaryPath = false; // true when WE created the temp file and must delete it

  // ── Resolve input ──────────────────────────────────────────────────────────
  if (typeof input === 'string') {
    // Base64 data-URI
    const matches = input.match(/^data:(.+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid Base64 format.');
    mimeType         = matches[1];
    const buffer     = Buffer.from(matches[2], 'base64');
    const ext        = mimeType.split('/')[1]?.split(';')[0] || 'bin';
    inputPath        = bufferToTempFile(buffer, `.${ext}`);
    isTemporaryPath  = true;

  } else if (input?.path && input?.mimetype) {
    // Multer diskStorage file object
    mimeType  = input.mimetype;
    inputPath = input.path;

  } else {
    throw new Error('Unsupported input: pass a base64 data-URI string or a Multer diskStorage file object.');
  }

  // ── Detect real MIME from file bytes (overrides declared MIME) ────────────
  try {
    const sampleBuffer = Buffer.alloc(4100);
    const fd           = fs.openSync(inputPath, 'r');
    const bytesRead    = fs.readSync(fd, sampleBuffer, 0, 4100, 0);
    fs.closeSync(fd);
    const detected = await fileTypeFromBuffer(sampleBuffer.slice(0, bytesRead));
    if (detected?.mime) mimeType = detected.mime;
  } catch {
    // If detection fails, proceed with declared MIME
  }

  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/') || mimeType === 'application/x-mpegurl';

  try {
    // ── Image path ─────────────────────────────────────────────────────────
    if (isImage) {
      if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
        throw new Error('Only JPEG and PNG images are accepted.');
      }

      const rawBuffer = fs.readFileSync(inputPath);
      const { buffer: finalBuf, mimeType: finalMime, extension } =
        await compressImage(rawBuffer, mimeType);

      const fileName = sanitizeFileName(`${directory}/${uuidv4()}.${extension}`);
      await uploadBufferToGCS(finalBuf, fileName, finalMime);

      return {
        url:          `https://storage.googleapis.com/${bucket.name}/${fileName}`,
        fileName,
        mediaType:    'image',
        sizeKB:       Number((finalBuf.length / 1024).toFixed(2)),
        uploadTimeMS: Date.now() - startTime,
        durationSec:  null,
      };
    }

    // ── Video path ─────────────────────────────────────────────────────────
    if (isVideo) {
      // Get original file size before conversion
      const { size: originalSize } = fs.statSync(inputPath);

      const { masterUrl, thumbnailUrl, fileName, durationSec } =
        await convertAndUploadHLS(inputPath, mimeType, directory);

      return {
        url:          masterUrl,
        thumbnailUrl,
        fileName,
        mediaType:    'video',
        sizeKB:       Number((originalSize / 1024).toFixed(2)),
        uploadTimeMS: Date.now() - startTime,
        durationSec,
      };
    }

    throw new Error(`Unsupported media type: ${mimeType}`);

  } finally {
    // Clean up the temp file only if WE created it (base64 path).
    // Multer disk files are the route's responsibility to delete after responding.
    if (isTemporaryPath) cleanupFile(inputPath);
  }
};

// ========================
// 🔹 Backward Compat
// ========================
export const uploadBase64MediaToGCS = (base64, directory = 'uploads') =>
  uploadMediaToGCS(base64, directory);


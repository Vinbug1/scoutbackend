import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { bucket } from './gcs-config.js';
import { fileTypeFromBuffer } from 'file-type';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import { encode } from 'blurhash';

const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
];

const ALLOWED_IMAGE_EXT = [
  '.jpg',
  '.jpeg',
  '.png',
];

const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/mpeg',
  'application/x-mpegurl',
];

const ALLOWED_VIDEO_EXT = [
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
  '.mpeg',
  '.mpg',
  '.m3u8',
  '.ts',
];

const multerStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, os.tmpdir());
  },

  filename: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(
      null,
      `${uuidv4()}${extension}`
    );
  },
});

export const upload = multer({
  storage: multerStorage,

  limits: {
    fileSize: 500 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const isImage =
      ALLOWED_IMAGE_MIME.includes(file.mimetype) &&
      ALLOWED_IMAGE_EXT.includes(extension);

    const isVideo =
      ALLOWED_VIDEO_MIME.includes(file.mimetype) &&
      ALLOWED_VIDEO_EXT.includes(extension);

    if (!isImage && !isVideo) {
      return callback(
        new Error(
          'Invalid file. Allowed: JPEG, PNG, MP4, MOV, AVI, WEBM, MPEG, M3U8, or TS.'
        ),
        false
      );
    }

    callback(null, true);
  },
});

const sanitizeFileName = (name) =>
  name
    .replace(/[^a-zA-Z0-9\-_.]/g, '_')
    .slice(0, 120);

const cleanupFile = (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may already have been deleted.
  }
};

const cleanupDir = (directoryPath) => {
  try {
    fs.rmSync(directoryPath, {
      recursive: true,
      force: true,
    });
  } catch {
    // Ignore cleanup errors.
  }
};

const bufferToTempFile = (buffer, extension) => {
  const tempPath = path.join(
    os.tmpdir(),
    `${uuidv4()}${extension}`
  );

  fs.writeFileSync(tempPath, buffer);

  return tempPath;
};

const uploadBufferToGCS = (
  buffer,
  blobPath,
  contentType
) =>
  new Promise((resolve, reject) => {
    const blob = bucket.file(blobPath);

    const stream = blob.createWriteStream({
      resumable: false,
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    stream.on('error', reject);
    stream.on('finish', resolve);
    stream.end(buffer);
  });

const compressImage = async (buffer, mimeType) => {
  const resized = sharp(buffer)
    .rotate()
    .resize({
      width: 1024,
      withoutEnlargement: true,
    });

  if (mimeType === 'image/png') {
    const compressed = await resized
      .png({ quality: 80 })
      .toBuffer();

    return {
      buffer: compressed,
      mimeType: 'image/png',
      extension: 'png',
    };
  }

  const compressed = await resized
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    buffer: compressed,
    mimeType: 'image/jpeg',
    extension: 'jpg',
  };
};

const generateBlurHash = async (buffer) => {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(32, 32, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  return encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    4,
    4
  );
};

const renditions = [
  {
    label: '1080p',
    height: 1080,
    videoBitrate: '4500k',
    audioBitrate: '192k',
  },
  {
    label: '720p',
    height: 720,
    videoBitrate: '2800k',
    audioBitrate: '128k',
  },
  {
    label: '480p',
    height: 480,
    videoBitrate: '1400k',
    audioBitrate: '128k',
  },
  {
    label: '360p',
    height: 360,
    videoBitrate: '800k',
    audioBitrate: '96k',
  },
];

const encodeRendition = (
  inputPath,
  temporaryDirectory,
  rendition
) => {
  const {
    label,
    height,
    videoBitrate,
    audioBitrate,
  } = rendition;

  const renditionDirectory = path.join(
    temporaryDirectory,
    label
  );

  fs.mkdirSync(renditionDirectory, {
    recursive: true,
  });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(
        path.join(
          renditionDirectory,
          'index.m3u8'
        )
      )
      .outputOptions([
        '-codec:v libx264',
        '-codec:a aac',
        `-b:v ${videoBitrate}`,
        `-b:a ${audioBitrate}`,
        `-vf scale=-2:${height}`,
        '-hls_time 2',
        '-hls_playlist_type vod',
        '-hls_segment_filename',
        path.join(
          renditionDirectory,
          'seg%04d.ts'
        ),
        '-start_number 0',
      ])
      .on('end', resolve)
      .on('error', (error) => {
        reject(
          new Error(
            `FFmpeg [${label}] error: ${error.message}`
          )
        );
      })
      .run();
  });
};

const convertAndUploadHLS = async (
  inputPath,
  mimeType,
  directory
) => {
  const sessionId = uuidv4();

  const temporaryDirectory = path.join(
    os.tmpdir(),
    `hls_${sessionId}`
  );

  const outputThumbnail = path.join(
    temporaryDirectory,
    'thumbnail.jpg'
  );

  fs.mkdirSync(temporaryDirectory, {
    recursive: true,
  });

  // Existing HLS playlist.
  if (mimeType === 'application/x-mpegurl') {
    try {
      const prefix = sanitizeFileName(
        `${directory}/${sessionId}`
      );

      const blobName = `${prefix}/index.m3u8`;
      const buffer = fs.readFileSync(inputPath);

      await uploadBufferToGCS(
        buffer,
        blobName,
        'application/x-mpegurl'
      );

      return {
        masterUrl:
          `https://storage.googleapis.com/` +
          `${bucket.name}/${blobName}`,
        thumbnailUrl: null,
        fileName: blobName,
        durationSec: null,
        blurHash: null,
      };
    } finally {
      cleanupDir(temporaryDirectory);
    }
  }

  let durationSec = null;

  try {
    await new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (_error, metadata) => {
        if (metadata?.format?.duration) {
          durationSec = Math.round(
            metadata.format.duration
          );
        }

        resolve();
      });
    });

    for (const rendition of renditions) {
      await encodeRendition(
        inputPath,
        temporaryDirectory,
        rendition
      );
    }

    const bandwidthMap = {
      '1080p': 4500000,
      '720p': 2800000,
      '480p': 1400000,
      '360p': 800000,
    };

    const resolutionMap = {
      '1080p': '1920x1080',
      '720p': '1280x720',
      '480p': '854x480',
      '360p': '640x360',
    };

    const masterLines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '',
    ];

    for (const { label } of renditions) {
      masterLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthMap[label]},RESOLUTION=${resolutionMap[label]}`,
        `${label}/index.m3u8`,
        ''
      );
    }

    const masterPlaylistPath = path.join(
      temporaryDirectory,
      'master.m3u8'
    );

    fs.writeFileSync(
      masterPlaylistPath,
      masterLines.join('\n')
    );

    // Generate thumbnail.
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: 'thumbnail.jpg',
          folder: temporaryDirectory,
          size: '1024x?',
        })
        .on('end', resolve)
        .on('error', () => {
          ffmpeg(inputPath)
            .screenshots({
              timestamps: ['00:00:00'],
              filename: 'thumbnail.jpg',
              folder: temporaryDirectory,
              size: '1024x?',
            })
            .on('end', resolve)
            .on('error', reject);
        });
    });

    if (!fs.existsSync(outputThumbnail)) {
      throw new Error(
        'Could not generate video thumbnail.'
      );
    }

    const rawThumbnail = fs.readFileSync(
      outputThumbnail
    );

    const {
      buffer: compressedThumbnail,
    } = await compressImage(
      rawThumbnail,
      'image/jpeg'
    );

    const blurHash = await generateBlurHash(
      compressedThumbnail
    );

    const prefix = sanitizeFileName(
      `${directory}/${sessionId}`
    );

    const uploadTasks = [];

    uploadTasks.push(
      uploadBufferToGCS(
        fs.readFileSync(masterPlaylistPath),
        `${prefix}/master.m3u8`,
        'application/x-mpegurl'
      )
    );

    for (const { label } of renditions) {
      const renditionDirectory = path.join(
        temporaryDirectory,
        label
      );

      for (const file of fs.readdirSync(
        renditionDirectory
      )) {
        const filePath = path.join(
          renditionDirectory,
          file
        );

        const contentType = file.endsWith('.m3u8')
          ? 'application/x-mpegurl'
          : 'video/MP2T';

        uploadTasks.push(
          uploadBufferToGCS(
            fs.readFileSync(filePath),
            `${prefix}/${label}/${file}`,
            contentType
          )
        );
      }
    }

    uploadTasks.push(
      uploadBufferToGCS(
        compressedThumbnail,
        `${prefix}/thumbnail.jpg`,
        'image/jpeg'
      )
    );

    await Promise.all(uploadTasks);

    return {
      masterUrl:
        `https://storage.googleapis.com/` +
        `${bucket.name}/${prefix}/master.m3u8`,
      thumbnailUrl:
        `https://storage.googleapis.com/` +
        `${bucket.name}/${prefix}/thumbnail.jpg`,
      fileName: `${prefix}/master.m3u8`,
      durationSec,
      blurHash,
    };
  } finally {
    cleanupDir(temporaryDirectory);
  }
};

export const uploadMediaToGCS = async (
  input,
  directory = 'uploads'
) => {
  const startTime = Date.now();

  let mimeType;
  let inputPath;
  let shouldCleanupInput = false;

  // Base64 input.
  if (typeof input === 'string') {
    const matches = input.match(
      /^data:([^;]+);base64,(.+)$/
    );

    if (!matches) {
      const error = new Error(
        'Invalid Base64 format.'
      );
      error.statusCode = 400;
      throw error;
    }

    mimeType = matches[1].toLowerCase();

    const buffer = Buffer.from(
      matches[2],
      'base64'
    );

    if (!buffer.length) {
      const error = new Error(
        'Base64 file is empty.'
      );
      error.statusCode = 400;
      throw error;
    }

    const extension =
      mimeType.split('/')[1] || 'bin';

    inputPath = bufferToTempFile(
      buffer,
      `.${extension}`
    );

    shouldCleanupInput = true;
  }

  // Multer diskStorage input.
  else if (input?.path && input?.mimetype) {
    mimeType = input.mimetype.toLowerCase();
    inputPath = input.path;
    shouldCleanupInput = true;
  }

  else {
    const error = new Error(
      'Unsupported input. Pass a Base64 data URI ' +
      'or a Multer diskStorage file.'
    );
    error.statusCode = 400;
    throw error;
  }

  try {
    if (!fs.existsSync(inputPath)) {
      const error = new Error(
        'Uploaded file could not be found.'
      );
      error.statusCode = 400;
      throw error;
    }

    const { size: originalSize } =
      fs.statSync(inputPath);

    if (!originalSize) {
      const error = new Error(
        'Uploaded file is empty.'
      );
      error.statusCode = 400;
      throw error;
    }

    // Detect MIME from file bytes.
    try {
      const sample = Buffer.alloc(4100);
      const fileDescriptor = fs.openSync(
        inputPath,
        'r'
      );

      try {
        const bytesRead = fs.readSync(
          fileDescriptor,
          sample,
          0,
          sample.length,
          0
        );

        const detected = await fileTypeFromBuffer(
          sample.subarray(0, bytesRead)
        );

        if (detected?.mime) {
          mimeType = detected.mime.toLowerCase();
        }
      } finally {
        fs.closeSync(fileDescriptor);
      }
    } catch {
      // Continue using the declared MIME type.
    }

    const isImage =
      typeof mimeType === 'string' &&
      mimeType.startsWith('image/');

    const isVideo =
      typeof mimeType === 'string' &&
      (
        mimeType.startsWith('video/') ||
        mimeType === 'application/x-mpegurl'
      );

    if (isImage) {
      if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
        const error = new Error(
          'Only JPEG and PNG images are accepted.'
        );
        error.statusCode = 400;
        throw error;
      }

      const rawBuffer = fs.readFileSync(
        inputPath
      );

      const {
        buffer: finalBuffer,
        mimeType: finalMimeType,
        extension,
      } = await compressImage(
        rawBuffer,
        mimeType
      );

      const blurHash = await generateBlurHash(
        finalBuffer
      );

      const fileName = sanitizeFileName(
        `${directory}/${uuidv4()}.${extension}`
      );

      await uploadBufferToGCS(
        finalBuffer,
        fileName,
        finalMimeType
      );

      return {
        url:
          `https://storage.googleapis.com/` +
          `${bucket.name}/${fileName}`,
        thumbnailUrl: null,
        fileName,
        mediaType: 'image',
        blurHash,
        sizeKB: Number(
          (finalBuffer.length / 1024).toFixed(2)
        ),
        uploadTimeMS: Date.now() - startTime,
        durationSec: null,
      };
    }

    if (isVideo) {
      const {
        masterUrl,
        thumbnailUrl,
        fileName,
        durationSec,
        blurHash,
      } = await convertAndUploadHLS(
        inputPath,
        mimeType,
        directory
      );

      return {
        url: masterUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        fileName,
        mediaType: 'video',
        blurHash: blurHash ?? null,
        sizeKB: Number(
          (originalSize / 1024).toFixed(2)
        ),
        uploadTimeMS: Date.now() - startTime,
        durationSec: durationSec ?? null,
      };
    }

    const error = new Error(
      `Unsupported media type: ${mimeType || 'unknown'}`
    );
    error.statusCode = 400;
    throw error;
  } finally {
    if (shouldCleanupInput && inputPath) {
      cleanupFile(inputPath);
    }
  }
};

// Chat upload fields.
export const uploadChatFields = upload.fields([
  {
    name: 'media',
    maxCount: 1,
  },
  {
    name: 'thumbnail',
    maxCount: 1,
  },
]);

export const handleChatUploadFields = (
  req,
  res,
  next
) => {
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);

  const cleanupUploadedFiles = () => {
    const files = Object.values(
      req.files || {}
    ).flat();

    for (const file of files) {
      if (file?.path) {
        cleanupFile(file.path);
      }
    }
  };

  req.on('aborted', cleanupUploadedFiles);

  uploadChatFields(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      cleanupUploadedFiles();

      return res.status(400).json({
        error: `Upload error: ${error.message}`,
      });
    }

    if (error) {
      cleanupUploadedFiles();

      return res.status(400).json({
        error: error.message,
      });
    }

    next();
  });
};

export const uploadVideoWithThumbnail = upload.fields([
  {
    name: 'video',
    maxCount: 1,
  },
  {
    name: 'thumbnail',
    maxCount: 1,
  },
]);

export const handleUploadFields = (
  req,
  res,
  next
) => {
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);

  const cleanupUploadedFiles = () => {
    const files = Object.values(
      req.files || {}
    ).flat();

    for (const file of files) {
      if (file?.path) {
        cleanupFile(file.path);
      }
    }
  };

  req.on('aborted', cleanupUploadedFiles);

  uploadVideoWithThumbnail(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      cleanupUploadedFiles();

      return res.status(400).json({
        error: `Upload error: ${error.message}`,
      });
    }

    if (error) {
      cleanupUploadedFiles();

      return res.status(400).json({
        error: error.message,
      });
    }

    next();
  });
};

export const uploadBase64MediaToGCS = (
  base64,
  directory = 'uploads'
) =>
  uploadMediaToGCS(
    base64,
    directory
  );











// import multer from 'multer';
// import path from 'path';
// import sharp from 'sharp';
// import { v4 as uuidv4 } from 'uuid';
// import { bucket } from './gcs-config.js';
// import { fileTypeFromBuffer } from 'file-type';
// import ffmpeg from 'fluent-ffmpeg';
// import fs from 'fs';
// import os from 'os';
// import { encode } from 'blurhash';

// // ========================
// // 🔹 Allowed Types
// // ========================
// const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png'];
// const ALLOWED_IMAGE_EXT  = ['.jpg', '.jpeg', '.png'];
// const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg', 'application/x-mpegurl'];
// const ALLOWED_VIDEO_EXT  = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg', '.m3u8', '.ts'];

// // ========================
// // 🔹 Multer Configuration
// // FIX: Use diskStorage instead of memoryStorage.
// //      memoryStorage holds the entire file in RAM — for 500 MB videos
// //      over slow/mobile connections the client times out mid-stream and
// //      multer throws "Request aborted". Streaming to disk avoids that.
// // ========================
// const multerStorage = multer.diskStorage({
//   destination: (_req, _file, cb) => cb(null, os.tmpdir()),
//   filename:    (_req, _file, cb) =>
//     cb(null, `${uuidv4()}${path.extname(_file.originalname).toLowerCase()}`),
// });

// export const upload = multer({
//   storage: multerStorage,
//   limits: { fileSize: 500 * 1024 * 1024 },  // 500 MB
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
// // 🔹 Named Field Uploads
// // FIX: Wrap in a factory so the route can use the callback form and
// //      catch multer errors instead of letting them propagate unhandled.
// // ========================
// export const uploadVideoWithThumbnail = upload.fields([
//   { name: 'video',     maxCount: 1 },   // required — must be a video
//   { name: 'thumbnail', maxCount: 1 },   // optional — must be JPEG/PNG
// ]);

// /**
//  * Express middleware wrapper for uploadVideoWithThumbnail.
//  * Use this in your route so multer errors are handled gracefully:
//  *
//  *   router.post('/upload', handleUploadFields, async (req, res) => { ... });
//  */
// export const handleUploadFields = (req, res, next) => {
//   // FIX: Increase socket timeout for long video uploads.
//   req.setTimeout(10 * 60 * 1000);   // 10 minutes
//   res.setTimeout(10 * 60 * 1000);

//   // FIX: Clean up any disk files if the client disconnects mid-upload.
//   req.on('close', () => {
//     if (!res.writableEnded) {
//       const files = Object.values(req.files || {}).flat();
//       files.forEach((f) => f.path && cleanupFile(f.path));
//     }
//   });

//   uploadVideoWithThumbnail(req, res, (err) => {
//     if (err instanceof multer.MulterError) {
//       return res.status(400).json({ error: `Upload error: ${err.message}` });
//     }
//     if (err) {
//       return res.status(400).json({ error: err.message });
//     }
//     next();
//   });
// };

// // ========================
// // 🔹 Helpers
// // ========================
// const sanitizeFileName = (name) =>
//   name.replace(/[^a-zA-Z0-9\-_.]/g, '_').slice(0, 120);

// /**
//  * Write a buffer to a temp file and return the path.
//  * Only used for base64 inputs — multer disk uploads already have a path.
//  */
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

// const generateBlurHash = async (buffer) => {
//   const { data, info } = await sharp(buffer)
//     .rotate()
//     .resize(32, 32, {
//       fit: 'inside',
//       withoutEnlargement: true,
//     })
//     .ensureAlpha()
//     .raw()
//     .toBuffer({ resolveWithObject: true });

//   return encode(
//     new Uint8ClampedArray(data),
//     info.width,
//     info.height,
//     4,
//     4
//   );
// };
// // ========================
// // 🔹 FFmpeg Rendition Encoder
// // FIX: Encode renditions sequentially instead of concurrently via
// //      Promise.all. Parallel encoding of a 500 MB file at 4 renditions
// //      simultaneously can spike to 2 GB+ of temp data and saturate CPU,
// //      causing timeouts. Sequential is slower but stable.
// // ========================
// const renditions = [
//   { label: '1080p', height: 1080, videoBitrate: '4500k', audioBitrate: '192k' },
//   { label: '720p',  height: 720,  videoBitrate: '2800k', audioBitrate: '128k' },
//   { label: '480p',  height: 480,  videoBitrate: '1400k', audioBitrate: '128k' },
//   { label: '360p',  height: 360,  videoBitrate:  '800k', audioBitrate:  '96k' },
// ];

// const encodeRendition = (inputPath, tmpDir, { label, height, videoBitrate, audioBitrate }) => {
//   const rendDir = path.join(tmpDir, label);
//   fs.mkdirSync(rendDir, { recursive: true });

//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .output(path.join(rendDir, 'index.m3u8'))
//       .outputOptions([
//         '-codec:v libx264',
//         '-codec:a aac',
//         `-b:v ${videoBitrate}`,
//         `-b:a ${audioBitrate}`,
//         `-vf scale=-2:${height}`,
//         '-hls_time 2',
//         '-hls_playlist_type vod',
//         '-hls_segment_filename', path.join(rendDir, 'seg%04d.ts'),
//         '-start_number 0',
//       ])
//       .on('end', resolve)
//       .on('error', (err) => reject(new Error(`FFmpeg [${label}] error: ${err.message}`)))
//       .run();
//   });
// };

// // ========================
// // 🔹 HLS Video Conversion
// // ========================
// const convertAndUploadHLS = async (inputPath, mimeType, directory) => {
//   const sessionId = uuidv4();
//   const tmpDir = path.join(os.tmpdir(), `hls_${sessionId}`);
//   const outputThumb = path.join(tmpDir, 'thumbnail.jpg');

//   fs.mkdirSync(tmpDir, { recursive: true });

//   // Already an HLS playlist.
//   // We cannot generate a thumbnail or BlurHash unless one is supplied separately.
//   if (mimeType === 'application/x-mpegurl') {
//     try {
//       const gcsPrefix = sanitizeFileName(`${directory}/${sessionId}`);
//       const blobName = `${gcsPrefix}/index.m3u8`;

//       const buffer = fs.readFileSync(inputPath);

//       await uploadBufferToGCS(
//         buffer,
//         blobName,
//         'application/x-mpegurl'
//       );

//       return {
//         masterUrl: `https://storage.googleapis.com/${bucket.name}/${blobName}`,
//         thumbnailUrl: null,
//         fileName: blobName,
//         durationSec: null,
//         blurHash: null,
//       };
//     } finally {
//       cleanupDir(tmpDir);
//     }
//   }

//   let probedDuration = null;

//   try {
//     // Probe video duration.
//     await new Promise((resolve) => {
//       ffmpeg.ffprobe(inputPath, (err, metadata) => {
//         if (!err && metadata?.format?.duration) {
//           probedDuration = Math.round(metadata.format.duration);
//         }

//         resolve();
//       });
//     });

//     // Encode all renditions sequentially.
//     for (const rendition of renditions) {
//       await encodeRendition(inputPath, tmpDir, rendition);
//     }

//     const bandwidthMap = {
//       '1080p': 4500000,
//       '720p': 2800000,
//       '480p': 1400000,
//       '360p': 800000,
//     };

//     const resolutionMap = {
//       '1080p': '1920x1080',
//       '720p': '1280x720',
//       '480p': '854x480',
//       '360p': '640x360',
//     };

//     const masterLines = [
//       '#EXTM3U',
//       '#EXT-X-VERSION:3',
//       '',
//     ];

//     for (const { label } of renditions) {
//       masterLines.push(
//         `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthMap[label]},RESOLUTION=${resolutionMap[label]}`,
//         `${label}/index.m3u8`,
//         ''
//       );
//     }

//     const masterPlaylistPath = path.join(tmpDir, 'master.m3u8');

//     fs.writeFileSync(
//       masterPlaylistPath,
//       masterLines.join('\n')
//     );

//     // Extract thumbnail at one second, then fall back to frame zero.
//     await new Promise((resolve, reject) => {
//       ffmpeg(inputPath)
//         .screenshots({
//           timestamps: ['00:00:01'],
//           filename: 'thumbnail.jpg',
//           folder: tmpDir,
//           size: '1024x?',
//         })
//         .on('end', resolve)
//         .on('error', () => {
//           ffmpeg(inputPath)
//             .screenshots({
//               timestamps: ['00:00:00'],
//               filename: 'thumbnail.jpg',
//               folder: tmpDir,
//               size: '1024x?',
//             })
//             .on('end', resolve)
//             .on('error', reject);
//         });
//     });

//     if (!fs.existsSync(outputThumb)) {
//       throw new Error('Could not generate video thumbnail.');
//     }

//     const rawThumb = fs.readFileSync(outputThumb);

//     const {
//       buffer: compressedThumb,
//     } = await compressImage(rawThumb, 'image/jpeg');

//     // Generate BlurHash from the processed video thumbnail.
//     const blurHash = await generateBlurHash(compressedThumb);

//     const gcsPrefix = sanitizeFileName(`${directory}/${sessionId}`);
//     const uploadTasks = [];

//     // Master playlist.
//     uploadTasks.push(
//       uploadBufferToGCS(
//         fs.readFileSync(masterPlaylistPath),
//         `${gcsPrefix}/master.m3u8`,
//         'application/x-mpegurl'
//       )
//     );

//     // Rendition playlists and segments.
//     for (const { label } of renditions) {
//       const rendDir = path.join(tmpDir, label);

//       for (const file of fs.readdirSync(rendDir)) {
//         const filePath = path.join(rendDir, file);
//         const fileBuffer = fs.readFileSync(filePath);
//         const gcsPath = `${gcsPrefix}/${label}/${file}`;

//         const contentType = file.endsWith('.m3u8')
//           ? 'application/x-mpegurl'
//           : 'video/MP2T';

//         uploadTasks.push(
//           uploadBufferToGCS(
//             fileBuffer,
//             gcsPath,
//             contentType
//           )
//         );
//       }
//     }

//     // Video thumbnail.
//     uploadTasks.push(
//       uploadBufferToGCS(
//         compressedThumb,
//         `${gcsPrefix}/thumbnail.jpg`,
//         'image/jpeg'
//       )
//     );

//     await Promise.all(uploadTasks);

//     return {
//       masterUrl: `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/master.m3u8`,
//       thumbnailUrl: `https://storage.googleapis.com/${bucket.name}/${gcsPrefix}/thumbnail.jpg`,
//       fileName: `${gcsPrefix}/master.m3u8`,
//       durationSec: probedDuration,
//       blurHash,
//     };
//   } finally {
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
// /**
//  * Accepts either:
//  *   • A base64 data-URI string  →  "data:<mime>;base64,<data>"
//  *   • A Multer file object      →  { path, mimetype, originalname, ... }
//  *                                  (diskStorage — has .path, not .buffer)
//  *
//  * @param {string|object} input
//  * @param {string}        directory  GCS folder prefix (default: 'uploads')
//  */
// export const uploadMediaToGCS = async (
//   input,
//   directory = 'uploads'
// ) => {
//   const startTime = Date.now();

//   let mimeType;
//   let inputPath;
//   let shouldCleanupInput = false;

//   // Resolve Base64 or Multer input.
//   if (typeof input === 'string') {
//     const matches = input.match(/^data:([^;]+);base64,(.+)$/);

//     if (!matches) {
//       const error = new Error('Invalid Base64 format.');
//       error.statusCode = 400;
//       throw error;
//     }

//     mimeType = matches[1].toLowerCase();

//     const buffer = Buffer.from(matches[2], 'base64');

//     if (!buffer.length) {
//       const error = new Error('Base64 file is empty.');
//       error.statusCode = 400;
//       throw error;
//     }

//     const ext = mimeType.split('/')[1] || 'bin';

//     inputPath = bufferToTempFile(buffer, `.${ext}`);
//     shouldCleanupInput = true;
//   } else if (input?.path && input?.mimetype) {
//     mimeType = input.mimetype.toLowerCase();
//     inputPath = input.path;

//     // This function owns the temporary Multer file after receiving it.
//     shouldCleanupInput = true;
//   } else {
//     const error = new Error(
//       'Unsupported input. Pass a Base64 data URI or a Multer diskStorage file.'
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   try {
//     if (!fs.existsSync(inputPath)) {
//       const error = new Error('Uploaded file could not be found.');
//       error.statusCode = 400;
//       throw error;
//     }

//     const { size: originalSize } = fs.statSync(inputPath);

//     if (!originalSize) {
//       const error = new Error('Uploaded file is empty.');
//       error.statusCode = 400;
//       throw error;
//     }

//     // Detect the actual file type from its bytes.
//     try {
//       const sampleBuffer = Buffer.alloc(4100);
//       const fd = fs.openSync(inputPath, 'r');

//       try {
//         const bytesRead = fs.readSync(
//           fd,
//           sampleBuffer,
//           0,
//           sampleBuffer.length,
//           0
//         );

//         const detected = await fileTypeFromBuffer(
//           sampleBuffer.subarray(0, bytesRead)
//         );

//         if (detected?.mime) {
//           mimeType = detected.mime.toLowerCase();
//         }
//       } finally {
//         fs.closeSync(fd);
//       }
//     } catch {
//       // Use the MIME type supplied by Multer if byte detection fails.
//     }

//     const isImage =
//       typeof mimeType === 'string' &&
//       mimeType.startsWith('image/');

//     const isVideo =
//       typeof mimeType === 'string' &&
//       (
//         mimeType.startsWith('video/') ||
//         mimeType === 'application/x-mpegurl'
//       );

//     // Image processing.
//     if (isImage) {
//       if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
//         const error = new Error(
//           'Only JPEG and PNG images are accepted.'
//         );
//         error.statusCode = 400;
//         throw error;
//       }

//       const rawBuffer = fs.readFileSync(inputPath);

//       const {
//         buffer: finalBuffer,
//         mimeType: finalMimeType,
//         extension,
//       } = await compressImage(rawBuffer, mimeType);

//       // Generate the hash from the processed image that will be displayed.
//       const blurHash = await generateBlurHash(finalBuffer);

//       const fileName = sanitizeFileName(
//         `${directory}/${uuidv4()}.${extension}`
//       );

//       await uploadBufferToGCS(
//         finalBuffer,
//         fileName,
//         finalMimeType
//       );

//       return {
//         url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
//         thumbnailUrl: null,
//         fileName,
//         mediaType: 'image',
//         blurHash,
//         sizeKB: Number(
//           (finalBuffer.length / 1024).toFixed(2)
//         ),
//         uploadTimeMS: Date.now() - startTime,
//         durationSec: null,
//       };
//     }

//     // Video processing.
//     if (isVideo) {
//       const {
//         masterUrl,
//         thumbnailUrl,
//         fileName,
//         durationSec,
//         blurHash,
//       } = await convertAndUploadHLS(
//         inputPath,
//         mimeType,
//         directory
//       );

//       return {
//         url: masterUrl,
//         thumbnailUrl: thumbnailUrl ?? null,
//         fileName,
//         mediaType: 'video',
//         blurHash: blurHash ?? null,
//         sizeKB: Number(
//           (originalSize / 1024).toFixed(2)
//         ),
//         uploadTimeMS: Date.now() - startTime,
//         durationSec: durationSec ?? null,
//       };
//     }

//     const error = new Error(
//       `Unsupported media type: ${mimeType || 'unknown'}`
//     );
//     error.statusCode = 400;
//     throw error;
//   } finally {
//     // Clean both Base64-created files and Multer temporary files.
//     if (shouldCleanupInput && inputPath) {
//       cleanupFile(inputPath);
//     }
//   }
// };

// export const uploadChatFields = upload.fields([
//   { name: 'media', maxCount: 1 },
//   { name: 'thumbnail', maxCount: 1 },
// ]);

// export const handleChatUploadFields = (req, res, next) => {
//   req.setTimeout(10 * 60 * 1000);
//   res.setTimeout(10 * 60 * 1000);

//   req.on('close', () => {
//     if (!res.writableEnded) {
//       const files = Object.values(req.files || {}).flat();
//       files.forEach((f) => f.path && cleanupFile(f.path));
//     }
//   });

//   uploadChatFields(req, res, (err) => {
//     if (err instanceof multer.MulterError) {
//       return res.status(400).json({ error: `Upload error: ${err.message}` });
//     }
//     if (err) {
//       return res.status(400).json({ error: err.message });
//     }
//     next();
//   });
// };
// // ========================
// // 🔹 Backward Compat
// // ========================
// export const uploadBase64MediaToGCS = (base64, directory = 'uploads') =>
//   uploadMediaToGCS(base64, directory);


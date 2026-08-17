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

// Voice notes are strictly .m4a for now. General audio (broader formats)
// will get its own allowlist when document uploads are built.
const ALLOWED_VOICE_NOTE_MIME = [
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
];

const ALLOWED_VOICE_NOTE_EXT = [
  '.m4a',
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

    const isVoiceNote =
      ALLOWED_VOICE_NOTE_MIME.includes(file.mimetype) &&
      ALLOWED_VOICE_NOTE_EXT.includes(extension);

    if (!isImage && !isVideo && !isVoiceNote) {
      return callback(
        new Error(
          'Invalid file. Allowed: JPEG, PNG, MP4, MOV, AVI, WEBM, MPEG, M3U8, TS, or M4A.'
        ),
        false
      );
    }

    callback(null, true);
  }
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
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new Error(
      'A non-empty image buffer is required for BlurHash.'
    );
  }

  const {
    data,
    info,
  } = await sharp(buffer)
    .rotate()
    .resize({
      width: 64,
      height: 64,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
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
    6,
    6
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
        blurhash: null,
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

    let blurhash = null;

    try {
      blurhash = await generateBlurHash(
        compressedThumbnail
      );
    } catch (error) {
      console.error(
        'Video BlurHash generation failed:',
        error
      );
    }

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
      blurhash,
    };
  } finally {
    cleanupDir(temporaryDirectory);
  }
};

const getAudioDurationSec = (inputPath) =>
  new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (_error, metadata) => {
      const duration = metadata?.format?.duration;
      resolve(duration ? Math.round(duration) : null);
    });
  });

const uploadVoiceNote = async (inputPath, directory) => {
  const durationSec = await getAudioDurationSec(inputPath);
  const buffer = fs.readFileSync(inputPath);

  const fileName = sanitizeFileName(
    `${directory}/${uuidv4()}.m4a`
  );

  await uploadBufferToGCS(buffer, fileName, 'audio/mp4');

  return {
    url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
    thumbnailUrl: null,
    fileName,
    durationSec,
    blurhash: null,
  };
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

  // Keep the client-declared mimetype/extension around. File-sniffing
  // below can misclassify an audio-only .m4a container as generic
  // video/mp4 (they share the same ISO-BMFF box structure), so these
  // are used as a fallback signal when deciding isAudio further down.
  const declaredMimeType = mimeType;

  const declaredExtension =
    input?.originalname
      ? path.extname(input.originalname).toLowerCase()
      : null;

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

    // A .m4a voice note and a generic .mp4 share the same container
    // format, so byte-sniffing can occasionally return 'video/mp4' or
    // 'audio/mp4' for either one. If that happens, fall back to what
    // the client declared (extension for multer uploads, mimetype for
    // base64 data URIs) to decide whether this is really a voice note.
    const sniffedAsGenericMp4Family =
      mimeType === 'video/mp4' || mimeType === 'audio/mp4';

    const declaredAsVoiceNote =
      declaredExtension === '.m4a' ||
      ALLOWED_VOICE_NOTE_MIME.includes(declaredMimeType);

    const isAudio =
      typeof mimeType === 'string' &&
      (
        ALLOWED_VOICE_NOTE_MIME.includes(mimeType) ||
        (sniffedAsGenericMp4Family && declaredAsVoiceNote)
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
      
          // Generated later when the chat message is sent.
          blurhash: null,
      
          sizeKB: Number(
            (finalBuffer.length / 1024).toFixed(2)
          ),
      
          uploadTimeMS: Date.now() - startTime,
          durationSec: null,
        };
      }

      if (isAudio) {
        const {
          url,
          durationSec,
        } = await uploadVoiceNote(
          inputPath,
          directory
        );

        return {
          url,
          thumbnailUrl: null,
          fileName: path.basename(url),
          mediaType: 'audio',
          blurhash: null,
          sizeKB: Number(
            (originalSize / 1024).toFixed(2)
          ),
          uploadTimeMS: Date.now() - startTime,
          durationSec: durationSec ?? null,
        };
      }

      if (isVideo) {
        const {
          masterUrl,
          thumbnailUrl,
          fileName,
          durationSec,
          blurhash,
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
          blurhash: blurhash ?? null,
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

// const ALLOWED_IMAGE_MIME = [
//   'image/jpeg',
//   'image/png',
// ];

// const ALLOWED_IMAGE_EXT = [
//   '.jpg',
//   '.jpeg',
//   '.png',
// ];

// const ALLOWED_VIDEO_MIME = [
//   'video/mp4',
//   'video/quicktime',
//   'video/x-msvideo',
//   'video/webm',
//   'video/mpeg',
//   'application/x-mpegurl',
// ];

// const ALLOWED_VIDEO_EXT = [
//   '.mp4',
//   '.mov',
//   '.avi',
//   '.webm',
//   '.mpeg',
//   '.mpg',
//   '.m3u8',
//   '.ts',
// ];

// // Voice notes are strictly .m4a for now. General audio (broader formats)
// // will get its own allowlist when document uploads are built.
// const ALLOWED_VOICE_NOTE_MIME = [
//   'audio/mp4',
//   'audio/x-m4a',
//   'audio/m4a',
//   'audio/aac',
// ];

// const ALLOWED_VOICE_NOTE_EXT = [
//   '.m4a',
// ];

// const multerStorage = multer.diskStorage({
//   destination: (_req, _file, callback) => {
//     callback(null, os.tmpdir());
//   },

//   filename: (_req, file, callback) => {
//     const extension = path
//       .extname(file.originalname)
//       .toLowerCase();

//     callback(
//       null,
//       `${uuidv4()}${extension}`
//     );
//   },
// });


// export const upload = multer({
//   storage: multerStorage,

//   limits: {
//     fileSize: 500 * 1024 * 1024,
//   },

//   // fileFilter: (_req, file, callback) => {
//   //   const extension = path
//   //     .extname(file.originalname)
//   //     .toLowerCase();

//   //   const isImage =
//   //     ALLOWED_IMAGE_MIME.includes(file.mimetype) &&
//   //     ALLOWED_IMAGE_EXT.includes(extension);

//   //   const isVideo =
//   //     ALLOWED_VIDEO_MIME.includes(file.mimetype) &&
//   //     ALLOWED_VIDEO_EXT.includes(extension);

//   //   if (!isImage && !isVideo) {
//   //     return callback(
//   //       new Error(
//   //         'Invalid file. Allowed: JPEG, PNG, MP4, MOV, AVI, WEBM, MPEG, M3U8, or TS.'
//   //       ),
//   //       false
//   //     );
//   //   }

//   //   callback(null, true);
//   // },

//   fileFilter: (_req, file, callback) => {
//     const extension = path
//       .extname(file.originalname)
//       .toLowerCase();

//     const isImage =
//       ALLOWED_IMAGE_MIME.includes(file.mimetype) &&
//       ALLOWED_IMAGE_EXT.includes(extension);

//     const isVideo =
//       ALLOWED_VIDEO_MIME.includes(file.mimetype) &&
//       ALLOWED_VIDEO_EXT.includes(extension);

//     const isVoiceNote =
//       ALLOWED_VOICE_NOTE_MIME.includes(file.mimetype) &&
//       ALLOWED_VOICE_NOTE_EXT.includes(extension);

//     if (!isImage && !isVideo && !isVoiceNote) {
//       return callback(
//         new Error(
//           'Invalid file. Allowed: JPEG, PNG, MP4, MOV, AVI, WEBM, MPEG, M3U8, TS, or M4A.'
//         ),
//         false
//       );
//     }

//     callback(null, true);
//   }
// });

// const sanitizeFileName = (name) =>
//   name
//     .replace(/[^a-zA-Z0-9\-_.]/g, '_')
//     .slice(0, 120);

// const cleanupFile = (filePath) => {
//   try {
//     fs.unlinkSync(filePath);
//   } catch {
//     // File may already have been deleted.
//   }
// };

// const cleanupDir = (directoryPath) => {
//   try {
//     fs.rmSync(directoryPath, {
//       recursive: true,
//       force: true,
//     });
//   } catch {
//     // Ignore cleanup errors.
//   }
// };

// const bufferToTempFile = (buffer, extension) => {
//   const tempPath = path.join(
//     os.tmpdir(),
//     `${uuidv4()}${extension}`
//   );

//   fs.writeFileSync(tempPath, buffer);

//   return tempPath;
// };

// const uploadBufferToGCS = (
//   buffer,
//   blobPath,
//   contentType
// ) =>
//   new Promise((resolve, reject) => {
//     const blob = bucket.file(blobPath);

//     const stream = blob.createWriteStream({
//       resumable: false,
//       contentType,
//       metadata: {
//         cacheControl: 'public, max-age=31536000',
//       },
//     });

//     stream.on('error', reject);
//     stream.on('finish', resolve);
//     stream.end(buffer);
//   });

// const compressImage = async (buffer, mimeType) => {
//   const resized = sharp(buffer)
//     .rotate()
//     .resize({
//       width: 1024,
//       withoutEnlargement: true,
//     });

//   if (mimeType === 'image/png') {
//     const compressed = await resized
//       .png({ quality: 80 })
//       .toBuffer();

//     return {
//       buffer: compressed,
//       mimeType: 'image/png',
//       extension: 'png',
//     };
//   }

//   const compressed = await resized
//     .jpeg({ quality: 80 })
//     .toBuffer();

//   return {
//     buffer: compressed,
//     mimeType: 'image/jpeg',
//     extension: 'jpg',
//   };
// };
// const generateBlurHash = async (buffer) => {
//   if (
//     !Buffer.isBuffer(buffer) ||
//     buffer.length === 0
//   ) {
//     throw new Error(
//       'A non-empty image buffer is required for BlurHash.'
//     );
//   }

//   const {
//     data,
//     info,
//   } = await sharp(buffer)
//     .rotate()
//     .resize({
//       width: 64,
//       height: 64,
//       fit: 'inside',
//       withoutEnlargement: true,
//       kernel: sharp.kernel.lanczos3,
//     })
//     .ensureAlpha()
//     .raw()
//     .toBuffer({
//       resolveWithObject: true,
//     });

//   return encode(
//     new Uint8ClampedArray(data),
//     info.width,
//     info.height,
//     6,
//     6
//   );
// };


// const renditions = [
//   {
//     label: '1080p',
//     height: 1080,
//     videoBitrate: '4500k',
//     audioBitrate: '192k',
//   },
//   {
//     label: '720p',
//     height: 720,
//     videoBitrate: '2800k',
//     audioBitrate: '128k',
//   },
//   {
//     label: '480p',
//     height: 480,
//     videoBitrate: '1400k',
//     audioBitrate: '128k',
//   },
//   {
//     label: '360p',
//     height: 360,
//     videoBitrate: '800k',
//     audioBitrate: '96k',
//   },
// ];

// const encodeRendition = (
//   inputPath,
//   temporaryDirectory,
//   rendition
// ) => {
//   const {
//     label,
//     height,
//     videoBitrate,
//     audioBitrate,
//   } = rendition;

//   const renditionDirectory = path.join(
//     temporaryDirectory,
//     label
//   );

//   fs.mkdirSync(renditionDirectory, {
//     recursive: true,
//   });

//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .output(
//         path.join(
//           renditionDirectory,
//           'index.m3u8'
//         )
//       )
//       .outputOptions([
//         '-codec:v libx264',
//         '-codec:a aac',
//         `-b:v ${videoBitrate}`,
//         `-b:a ${audioBitrate}`,
//         `-vf scale=-2:${height}`,
//         '-hls_time 2',
//         '-hls_playlist_type vod',
//         '-hls_segment_filename',
//         path.join(
//           renditionDirectory,
//           'seg%04d.ts'
//         ),
//         '-start_number 0',
//       ])
//       .on('end', resolve)
//       .on('error', (error) => {
//         reject(
//           new Error(
//             `FFmpeg [${label}] error: ${error.message}`
//           )
//         );
//       })
//       .run();
//   });
// };

// const convertAndUploadHLS = async (
//   inputPath,
//   mimeType,
//   directory
// ) => {
//   const sessionId = uuidv4();

//   const temporaryDirectory = path.join(
//     os.tmpdir(),
//     `hls_${sessionId}`
//   );

//   const outputThumbnail = path.join(
//     temporaryDirectory,
//     'thumbnail.jpg'
//   );

//   fs.mkdirSync(temporaryDirectory, {
//     recursive: true,
//   });

//   // Existing HLS playlist.
//   if (mimeType === 'application/x-mpegurl') {
//     try {
//       const prefix = sanitizeFileName(
//         `${directory}/${sessionId}`
//       );

//       const blobName = `${prefix}/index.m3u8`;
//       const buffer = fs.readFileSync(inputPath);

//       await uploadBufferToGCS(
//         buffer,
//         blobName,
//         'application/x-mpegurl'
//       );

//       return {
//         masterUrl:
//           `https://storage.googleapis.com/` +
//           `${bucket.name}/${blobName}`,
//         thumbnailUrl: null,
//         fileName: blobName,
//         durationSec: null,
//         blurhash: null,
//       };
//     } finally {
//       cleanupDir(temporaryDirectory);
//     }
//   }

//   let durationSec = null;

//   try {
//     await new Promise((resolve) => {
//       ffmpeg.ffprobe(inputPath, (_error, metadata) => {
//         if (metadata?.format?.duration) {
//           durationSec = Math.round(
//             metadata.format.duration
//           );
//         }

//         resolve();
//       });
//     });

//     for (const rendition of renditions) {
//       await encodeRendition(
//         inputPath,
//         temporaryDirectory,
//         rendition
//       );
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

//     const masterPlaylistPath = path.join(
//       temporaryDirectory,
//       'master.m3u8'
//     );

//     fs.writeFileSync(
//       masterPlaylistPath,
//       masterLines.join('\n')
//     );

//     // Generate thumbnail.
//     await new Promise((resolve, reject) => {
//       ffmpeg(inputPath)
//         .screenshots({
//           timestamps: ['00:00:01'],
//           filename: 'thumbnail.jpg',
//           folder: temporaryDirectory,
//           size: '1024x?',
//         })
//         .on('end', resolve)
//         .on('error', () => {
//           ffmpeg(inputPath)
//             .screenshots({
//               timestamps: ['00:00:00'],
//               filename: 'thumbnail.jpg',
//               folder: temporaryDirectory,
//               size: '1024x?',
//             })
//             .on('end', resolve)
//             .on('error', reject);
//         });
//     });

//     if (!fs.existsSync(outputThumbnail)) {
//       throw new Error(
//         'Could not generate video thumbnail.'
//       );
//     }

//     const rawThumbnail = fs.readFileSync(
//       outputThumbnail
//     );

//     const {
//       buffer: compressedThumbnail,
//     } = await compressImage(
//       rawThumbnail,
//       'image/jpeg'
//     );

//     let blurhash = null;

// try {
//   blurhash = await generateBlurHash(
//     compressedThumbnail
//   );
// } catch (error) {
//   console.error(
//     'Video BlurHash generation failed:',
//     error
//   );
// }

//     const prefix = sanitizeFileName(
//       `${directory}/${sessionId}`
//     );

//     const uploadTasks = [];

//     uploadTasks.push(
//       uploadBufferToGCS(
//         fs.readFileSync(masterPlaylistPath),
//         `${prefix}/master.m3u8`,
//         'application/x-mpegurl'
//       )
//     );

//     for (const { label } of renditions) {
//       const renditionDirectory = path.join(
//         temporaryDirectory,
//         label
//       );

//       for (const file of fs.readdirSync(
//         renditionDirectory
//       )) {
//         const filePath = path.join(
//           renditionDirectory,
//           file
//         );

//         const contentType = file.endsWith('.m3u8')
//           ? 'application/x-mpegurl'
//           : 'video/MP2T';

//         uploadTasks.push(
//           uploadBufferToGCS(
//             fs.readFileSync(filePath),
//             `${prefix}/${label}/${file}`,
//             contentType
//           )
//         );
//       }
//     }

//     uploadTasks.push(
//       uploadBufferToGCS(
//         compressedThumbnail,
//         `${prefix}/thumbnail.jpg`,
//         'image/jpeg'
//       )
//     );

//     await Promise.all(uploadTasks);

//     return {
//       masterUrl:
//         `https://storage.googleapis.com/` +
//         `${bucket.name}/${prefix}/master.m3u8`,
//       thumbnailUrl:
//         `https://storage.googleapis.com/` +
//         `${bucket.name}/${prefix}/thumbnail.jpg`,
//       fileName: `${prefix}/master.m3u8`,
//       durationSec,
//       blurhash,
//     };
//   } finally {
//     cleanupDir(temporaryDirectory);
//   }
// };

// const getAudioDurationSec = (inputPath) =>
//   new Promise((resolve) => {
//     ffmpeg.ffprobe(inputPath, (_error, metadata) => {
//       const duration = metadata?.format?.duration;
//       resolve(duration ? Math.round(duration) : null);
//     });
//   });

// const uploadVoiceNote = async (inputPath, directory) => {
//   const durationSec = await getAudioDurationSec(inputPath);
//   const buffer = fs.readFileSync(inputPath);

//   const fileName = sanitizeFileName(
//     `${directory}/${uuidv4()}.m4a`
//   );

//   await uploadBufferToGCS(buffer, fileName, 'audio/mp4');

//   return {
//     url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
//     thumbnailUrl: null,
//     fileName,
//     durationSec,
//     blurhash: null,
//   };
// };

// export const uploadMediaToGCS = async (
//   input,
//   directory = 'uploads'
// ) => {
//   const startTime = Date.now();

//   let mimeType;
//   let inputPath;
//   let shouldCleanupInput = false;

//   // Base64 input.
//   if (typeof input === 'string') {
//     const matches = input.match(
//       /^data:([^;]+);base64,(.+)$/
//     );

//     if (!matches) {
//       const error = new Error(
//         'Invalid Base64 format.'
//       );
//       error.statusCode = 400;
//       throw error;
//     }

//     mimeType = matches[1].toLowerCase();

//     const buffer = Buffer.from(
//       matches[2],
//       'base64'
//     );

//     if (!buffer.length) {
//       const error = new Error(
//         'Base64 file is empty.'
//       );
//       error.statusCode = 400;
//       throw error;
//     }

//     const extension =
//       mimeType.split('/')[1] || 'bin';

//     inputPath = bufferToTempFile(
//       buffer,
//       `.${extension}`
//     );

//     shouldCleanupInput = true;
//   }

//   // Multer diskStorage input.
//   else if (input?.path && input?.mimetype) {
//     mimeType = input.mimetype.toLowerCase();
//     inputPath = input.path;
//     shouldCleanupInput = true;
//   }

//   else {
//     const error = new Error(
//       'Unsupported input. Pass a Base64 data URI ' +
//       'or a Multer diskStorage file.'
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   try {
//     if (!fs.existsSync(inputPath)) {
//       const error = new Error(
//         'Uploaded file could not be found.'
//       );
//       error.statusCode = 400;
//       throw error;
//     }

//     const { size: originalSize } =
//       fs.statSync(inputPath);

//     if (!originalSize) {
//       const error = new Error(
//         'Uploaded file is empty.'
//       );
//       error.statusCode = 400;
//       throw error;
//     }

//     // Detect MIME from file bytes.
//     try {
//       const sample = Buffer.alloc(4100);
//       const fileDescriptor = fs.openSync(
//         inputPath,
//         'r'
//       );

//       try {
//         const bytesRead = fs.readSync(
//           fileDescriptor,
//           sample,
//           0,
//           sample.length,
//           0
//         );

//         const detected = await fileTypeFromBuffer(
//           sample.subarray(0, bytesRead)
//         );

//         if (detected?.mime) {
//           mimeType = detected.mime.toLowerCase();
//         }
//       } finally {
//         fs.closeSync(fileDescriptor);
//       }
//     } catch {
//       // Continue using the declared MIME type.
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

//       if (isImage) {
//         if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
//           const error = new Error(
//             'Only JPEG and PNG images are accepted.'
//           );
      
//           error.statusCode = 400;
//           throw error;
//         }
      
//         const rawBuffer = fs.readFileSync(
//           inputPath
//         );
      
//         const {
//           buffer: finalBuffer,
//           mimeType: finalMimeType,
//           extension,
//         } = await compressImage(
//           rawBuffer,
//           mimeType
//         );
      
//         const fileName = sanitizeFileName(
//           `${directory}/${uuidv4()}.${extension}`
//         );
      
//         await uploadBufferToGCS(
//           finalBuffer,
//           fileName,
//           finalMimeType
//         );
      
//         return {
//           url:
//             `https://storage.googleapis.com/` +
//             `${bucket.name}/${fileName}`,
      
//           thumbnailUrl: null,
//           fileName,
      
//           mediaType: 'image',
      
//           // Generated later when the chat message is sent.
//           blurhash: null,
      
//           sizeKB: Number(
//             (finalBuffer.length / 1024).toFixed(2)
//           ),
      
//           uploadTimeMS: Date.now() - startTime,
//           durationSec: null,
//         };
//       }

//       if (isAudio) {
//         const {
//           url,
//           durationSec,
//         } = await uploadVoiceNote(
//           inputPath,
//           directory
//         );

//         return {
//           url,
//           thumbnailUrl: null,
//           fileName: path.basename(url),
//           mediaType: 'audio',
//           blurhash: null,
//           sizeKB: Number(
//             (originalSize / 1024).toFixed(2)
//           ),
//           uploadTimeMS: Date.now() - startTime,
//           durationSec: durationSec ?? null,
//         };
//       }

//       if (isVideo) {
//         const {
//           masterUrl,
//           thumbnailUrl,
//           fileName,
//           durationSec,
//           blurhash,
//         } = await convertAndUploadHLS(
//           inputPath,
//           mimeType,
//           directory
//         );
      
//         return {
//           url: masterUrl,
//           thumbnailUrl: thumbnailUrl ?? null,
//           fileName,
//           mediaType: 'video',
//           blurhash: blurhash ?? null,
//           sizeKB: Number(
//             (originalSize / 1024).toFixed(2)
//           ),
//           uploadTimeMS: Date.now() - startTime,
//           durationSec: durationSec ?? null,
//         };
//       }

//     const error = new Error(
//       `Unsupported media type: ${mimeType || 'unknown'}`
//     );
//     error.statusCode = 400;
//     throw error;
//   } finally {
//     if (shouldCleanupInput && inputPath) {
//       cleanupFile(inputPath);
//     }
//   }
// };

// // Chat upload fields.
// export const uploadChatFields = upload.fields([
//   {
//     name: 'media',
//     maxCount: 1,
//   },
//   {
//     name: 'thumbnail',
//     maxCount: 1,
//   },
// ]);

// export const handleChatUploadFields = (
//   req,
//   res,
//   next
// ) => {
//   req.setTimeout(10 * 60 * 1000);
//   res.setTimeout(10 * 60 * 1000);

//   const cleanupUploadedFiles = () => {
//     const files = Object.values(
//       req.files || {}
//     ).flat();

//     for (const file of files) {
//       if (file?.path) {
//         cleanupFile(file.path);
//       }
//     }
//   };

//   req.on('aborted', cleanupUploadedFiles);

//   uploadChatFields(req, res, (error) => {
//     if (error instanceof multer.MulterError) {
//       cleanupUploadedFiles();

//       return res.status(400).json({
//         error: `Upload error: ${error.message}`,
//       });
//     }

//     if (error) {
//       cleanupUploadedFiles();

//       return res.status(400).json({
//         error: error.message,
//       });
//     }

//     next();
//   });
// };

// export const uploadVideoWithThumbnail = upload.fields([
//   {
//     name: 'video',
//     maxCount: 1,
//   },
//   {
//     name: 'thumbnail',
//     maxCount: 1,
//   },
// ]);

// export const handleUploadFields = (
//   req,
//   res,
//   next
// ) => {
//   req.setTimeout(10 * 60 * 1000);
//   res.setTimeout(10 * 60 * 1000);

//   const cleanupUploadedFiles = () => {
//     const files = Object.values(
//       req.files || {}
//     ).flat();

//     for (const file of files) {
//       if (file?.path) {
//         cleanupFile(file.path);
//       }
//     }
//   };

//   req.on('aborted', cleanupUploadedFiles);

//   uploadVideoWithThumbnail(req, res, (error) => {
//     if (error instanceof multer.MulterError) {
//       cleanupUploadedFiles();

//       return res.status(400).json({
//         error: `Upload error: ${error.message}`,
//       });
//     }

//     if (error) {
//       cleanupUploadedFiles();

//       return res.status(400).json({
//         error: error.message,
//       });
//     }

//     next();
//   });
// };

// export const uploadBase64MediaToGCS = (
//   base64,
//   directory = 'uploads'
// ) =>
//   uploadMediaToGCS(
//     base64,
//     directory
//   );

  

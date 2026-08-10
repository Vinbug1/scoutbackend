// utils/blurhash-utils.js

import sharp from 'sharp';
import { encode } from 'blurhash';
import { bucket } from '../config/gcs-config.js';

const ALLOWED_GCS_HOSTNAMES = new Set([
  'storage.googleapis.com',
  'storage.cloud.google.com',
]);

const generateBlurHash = async (imageBuffer) => {
  if (
    !Buffer.isBuffer(imageBuffer) ||
    imageBuffer.length === 0
  ) {
    throw new Error(
      'A non-empty image buffer is required.'
    );
  }

  const {
    data,
    info,
  } = await sharp(imageBuffer)
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

const getGCSFileNameFromUrl = (mediaUrl) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(mediaUrl);
  } catch {
    throw new Error('Invalid media URL.');
  }

  if (
    !ALLOWED_GCS_HOSTNAMES.has(
      parsedUrl.hostname
    )
  ) {
    throw new Error(
      'Media URL must belong to Google Cloud Storage.'
    );
  }

  const bucketPrefix =
    `/${bucket.name}/`;

  if (
    !parsedUrl.pathname.startsWith(bucketPrefix)
  ) {
    throw new Error(
      'Media URL does not belong to the configured bucket.'
    );
  }

  const fileName = decodeURIComponent(
    parsedUrl.pathname.slice(
      bucketPrefix.length
    )
  );

  if (!fileName) {
    throw new Error(
      'Media file name is missing.'
    );
  }

  return fileName;
};

export const generateBlurHashFromImageUrl = async (
  mediaUrl
) => {
  const fileName =
    getGCSFileNameFromUrl(mediaUrl);

  const file = bucket.file(fileName);

  const [exists] = await file.exists();

  if (!exists) {
    throw new Error(
      'The image does not exist in Google Cloud Storage.'
    );
  }

  const [imageBuffer] =
    await file.download();

  return generateBlurHash(imageBuffer);
};
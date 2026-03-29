const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// ─── S3 / R2 client (lazy-initialized) ──────────────────────────────────────
let s3 = null;
function getS3() {
  if (!s3) {
    if (STORAGE_TYPE === 'r2') {
      s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY,
          secretAccessKey: process.env.R2_SECRET_KEY,
        },
      });
    } else if (STORAGE_TYPE === 's3') {
      s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_KEY,
        },
      });
    }
  }
  return s3;
}

const BUCKET = process.env.R2_BUCKET || process.env.S3_BUCKET || 'grgr-videos';

/**
 * Upload a file to storage.
 * @param {string} localPath - Absolute path to the file on disk.
 * @param {string} key - Storage key / relative path (e.g. "videos/abc/720p.mp4").
 * @param {string} [contentType] - MIME type.
 * @returns {Promise<string>} The public URL or storage key.
 */
async function upload(localPath, key, contentType) {
  if (STORAGE_TYPE === 'local') {
    const dest = path.join(UPLOADS_DIR, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(localPath, dest);
    return `/uploads/${key}`;
  }

  const body = fs.readFileSync(localPath);
  await getS3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  if (STORAGE_TYPE === 'r2' && process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  return key;
}

/**
 * Upload a Buffer directly to storage.
 * @param {Buffer} buffer
 * @param {string} key
 * @param {string} [contentType]
 * @returns {Promise<string>}
 */
async function uploadBuffer(buffer, key, contentType) {
  if (STORAGE_TYPE === 'local') {
    const dest = path.join(UPLOADS_DIR, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buffer);
    return `/uploads/${key}`;
  }

  await getS3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  if (STORAGE_TYPE === 'r2' && process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  return key;
}

/**
 * Generate a presigned URL for client-side direct upload.
 * @param {string} key - Storage key.
 * @param {string} contentType - MIME type the client will upload.
 * @param {number} [expiresIn=3600] - Seconds until the URL expires.
 * @returns {Promise<string>}
 */
async function getPresignedUploadUrl(key, contentType, expiresIn = 3600) {
  if (STORAGE_TYPE === 'local') {
    // Local mode: return the API endpoint that accepts the upload
    return `/api/feed/upload`;
  }

  const url = await getSignedUrl(
    getS3(),
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  );
  return url;
}

/**
 * Delete a file from storage.
 * @param {string} key - Storage key or local path.
 */
async function remove(key) {
  if (STORAGE_TYPE === 'local') {
    const fullPath = key.startsWith('/uploads')
      ? path.join(UPLOADS_DIR, '..', key)
      : path.join(UPLOADS_DIR, key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    return;
  }

  await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { upload, uploadBuffer, getPresignedUploadUrl, remove, STORAGE_TYPE };

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '../config/env.js';

export function isS3Enabled() {
  return Boolean(env.awsS3Bucket && env.awsRegion && env.awsAccessKeyId && env.awsSecretAccessKey);
}

let client;

function s3() {
  if (!isS3Enabled()) {
    throw new Error('S3 is not configured');
  }
  if (!client) {
    client = new S3Client({
      region: env.awsRegion,
      credentials: {
        accessKeyId: env.awsAccessKeyId,
        secretAccessKey: env.awsSecretAccessKey,
      },
    });
  }
  return client;
}

export function s3HostOrigins() {
  if (!env.awsS3Bucket || !env.awsRegion) return [];
  return [
    `https://${env.awsS3Bucket}.s3.${env.awsRegion}.amazonaws.com`,
    `https://s3.${env.awsRegion}.amazonaws.com`,
  ];
}

export function parseS3Key(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('s3:')) return url.slice(3).replace(/^\/+/, '');
  return null;
}

export function s3StoredUrl(key) {
  return `s3:${key}`;
}

export async function uploadBuffer({ key, body, contentType }) {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  return s3StoredUrl(key);
}

export async function signedGetUrl(stored) {
  const key = parseS3Key(stored);
  if (!key) return stored || null;
  if (!isS3Enabled()) return stored;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.awsS3Bucket, Key: key }), {
    expiresIn: env.s3SignedUrlExpires,
  });
}

export async function presentMaterial(row) {
  if (!row) return row;
  const [file_url, video_url] = await Promise.all([signedGetUrl(row.file_url), signedGetUrl(row.video_url)]);
  return { ...row, file_url, video_url };
}

export async function presentMaterials(rows) {
  return Promise.all((rows || []).map((row) => presentMaterial(row)));
}

export async function deleteStoredAsset(stored) {
  const key = parseS3Key(stored);
  if (!key || !isS3Enabled()) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: env.awsS3Bucket, Key: key }));
  } catch (err) {
    console.warn('[s3] delete skipped:', err.message);
  }
}

/** Do not overwrite the stored S3 key with a temporary signed URL from the admin form. */
export function keepStoredUrl(incoming, previous) {
  if (incoming === undefined) return undefined;
  if (incoming == null || incoming === '') return incoming;
  const value = String(incoming);
  if (value.startsWith('s3:')) return value;
  if (/amazonaws\.com|X-Amz-/i.test(value)) return previous;
  return incoming;
}

export async function readTextObject(stored, max = 20000) {
  const key = parseS3Key(stored);
  if (!key || !isS3Enabled()) return '';
  const out = await s3().send(new GetObjectCommand({ Bucket: env.awsS3Bucket, Key: key }));
  const str = await out.Body.transformToString('utf-8');
  return str.slice(0, max);
}

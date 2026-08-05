import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadRoot = process.env.VERCEL
  ? path.join('/tmp', env.uploadDir || 'uploads')
  : path.join(__dirname, '..', '..', env.uploadDir || 'uploads');

const videoDir = path.join(uploadRoot, 'videos');
const docsDir = path.join(uploadRoot, 'docs');

for (const dir of [uploadRoot, videoDir, docsDir]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn('[upload] mkdir skipped:', dir, err.message);
  }
}

const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogg', '.mov', '.mkv']);
const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.epub', '.txt', '.png', '.jpg', '.jpeg', '.webp']);

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(uploadRoot, subdir)),
    filename: (_req, file, cb) => {
      // Never trust original filename — random name + allowlisted extension only
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = (subdir === 'videos' ? VIDEO_EXT : DOC_EXT).has(ext) ? ext : '';
      cb(null, `${Date.now()}-${randomUUID()}${safeExt}`);
    },
  });
}

const videoFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const ok = VIDEO_EXT.has(ext) && (file.mimetype.startsWith('video/') || file.mimetype === 'application/octet-stream');
  cb(ok ? null : new Error('Only video files are allowed (mp4, webm, mov, mkv, ogg)'), ok);
};

const docFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const ok =
    DOC_EXT.has(ext) &&
    (file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.includes('document') ||
      file.mimetype.includes('msword') ||
      file.mimetype.includes('officedocument') ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/epub+zip' ||
      file.mimetype === 'application/octet-stream');
  cb(ok ? null : new Error('Only PDF / document / image files are allowed'), ok);
};

export const uploadVideo = multer({
  storage: makeStorage('videos'),
  limits: { fileSize: env.maxUploadVideoMb * 1024 * 1024, files: 1 },
  fileFilter: videoFilter,
}).single('video');

export const uploadDoc = multer({
  storage: makeStorage('docs'),
  limits: { fileSize: env.maxUploadDocMb * 1024 * 1024, files: 1 },
  fileFilter: docFilter,
}).single('file');

export function publicUploadUrl(filename, kind = 'videos') {
  // Prevent path traversal in URL construction
  const base = path.basename(filename);
  return `/uploads/${kind}/${base}`;
}

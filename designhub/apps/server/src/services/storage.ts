import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../lib/env';

export const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as const;
export type ImageMime = keyof typeof IMAGE_TYPES;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PresignedUpload { uploadUrl: string; headers: Record<string, string>; url: string }

/** Schmale Schnittstelle zum Objektspeicher; Tests übergeben einen Stub. */
export interface ObjectStore {
  /** Kurzlebige URL, unter der der Browser genau dieses Objekt mit genau diesem Typ und dieser Größe hochladen darf. */
  presignUpload(key: string, mime: ImageMime, size: number): Promise<PresignedUpload>;
}

const EXPIRES_SECONDS = 300;

export function createS3Store(env: Env): ObjectStore | null {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_PUBLIC_URL) return null;
  const bucket = env.S3_BUCKET;
  const publicUrl = env.S3_PUBLIC_URL.replace(/\/$/, '');
  const client = new S3Client({
    region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: true, // RustFS/MinIO: Bucket im Pfad statt als Subdomain
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });
  return {
    async presignUpload(key, mime, size) {
      // ContentType und ContentLength sind Teil der Signatur: ein anderer Typ oder eine andere Größe wird abgelehnt.
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: size, CacheControl: 'public, max-age=31536000, immutable' });
      const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: EXPIRES_SECONDS, signableHeaders: new Set(['content-type', 'content-length', 'cache-control']) });
      return { uploadUrl, headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable' }, url: `${publicUrl}/${key}` };
    },
  };
}

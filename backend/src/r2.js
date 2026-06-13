import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ENDPOINT = 'https://37b6c2f5013adcec53f0deac6c046fa1.r2.cloudflarestorage.com';
const R2_ACCESS_KEY_ID = '5c01b90dc457eb5fcdf78913297f3a0a';
const R2_SECRET_ACCESS_KEY = 'f9e9d7a4f2ea0788b3873afd1fa0ff8a00e465cc10ab8d33129c3407d72ddea5';
const R2_BUCKET = 'image';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a buffer to Cloudflare R2 via presigned URL + fetch,
 * bypassing the AWS SDK HTTP handler to avoid TLS handshake issues.
 */
export async function uploadToR2(buffer, key, contentType = 'image/png') {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': contentType },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed: ${response.status} ${text}`);
  }
  return `https://pub-0c0a96d4451640d891f0642b17ac8eb2.r2.dev/${key}`;
}

export async function deleteFromR2(key) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const response = await fetch(signedUrl, { method: 'DELETE' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 delete failed: ${response.status} ${text}`);
  }
}

export async function listR2Objects() {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET,
  });
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const response = await fetch(signedUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 list failed: ${response.status} ${text}`);
  }
  const xml = await response.text();
  const keys = [];
  const regex = /<Key>([^<]+)<\/Key>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

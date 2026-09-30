import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2: set R2_ENDPOINT + keys. AWS S3: leave R2_ENDPOINT/keys empty — region comes
// from AWS_REGION and credentials from the EC2 instance role.
const s3Client = new S3Client({
  region: process.env.R2_ENDPOINT ? "auto" : process.env.AWS_REGION,
  endpoint: process.env.R2_ENDPOINT || undefined,
  credentials: process.env.R2_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

export async function uploadToR2(
  file: File,
  key: string
): Promise<{ url: string; key: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;
    return { url, key };
  } catch (error) {
    console.error("Error uploading to R2:", error);
    throw new Error("Failed to upload image");
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from R2:", error);
    throw new Error("Failed to delete image");
  }
}

export function generateImageKey(prefix: string, fileName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = fileName.split(".").pop();
  return `${prefix}/${timestamp}-${randomString}.${extension}`;
}

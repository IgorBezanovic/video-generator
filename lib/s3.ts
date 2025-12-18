import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION
const BUCKET = process.env.S3_BUCKET_NAME
if (!REGION || !BUCKET) {
  console.warn('AWS_REGION or S3_BUCKET_NAME not set. S3 uploads/downloads will fail without these env vars.')
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// Uploads a buffer to S3 and returns a public URL
export async function uploadToS3(key: string, body: Buffer, contentType: string) {
  const client = new S3Client({ region: REGION })
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType
    // NOTE: Do not set ACL here. Some buckets have Block Public Access or
    // 'Bucket owner enforced' Object Ownership which disallow ACLs.
    // Make objects public with a bucket policy, or use presigned URLs when needed.
  })
  try {
    await client.send(cmd)
  } catch (err) {
    console.error('S3 put object error', err)
    throw err
  }
  const region = REGION
  const url = `${process.env.S3_PUBLIC_URL ?? `https://${BUCKET}.s3.${region}.amazonaws.com`}/${encodeURIComponent(key)}`
  return url
}

// Download an object from S3 and return as Buffer
export async function getObjectBuffer(key: string) {
  const client = new S3Client({ region: REGION })
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  const res = await client.send(cmd)
  // res.Body is a stream
  return await streamToBuffer(res.Body as any)
}

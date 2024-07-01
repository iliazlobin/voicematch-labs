import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { IncomingMessage } from 'http';
import { pipeline } from 'stream/promises';

const s3Client = new S3Client({ region: 'us-east-1' });

export async function checkObjectExist(bucket: string, key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  } catch (err) {
    if (err.name !== 'NotFound') {
      const { requestId, cfId, extendedRequestId } = err.$metadata;
      throw new Error(`failed to request s3: ${requestId}, ${cfId}, ${extendedRequestId}`);
    }
    return false;
  }
  return true;
}

export async function uploadObject(file: string, bucket: string, key: string): Promise<void> {
  try {
    const output = await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Body: fs.readFileSync(file),
      Key: key,
    }));

    if (output.$metadata.httpStatusCode !== 200) {
      throw new Error('code is not 200');
    }
  } catch (err) {
    const { requestId, cfId, extendedRequestId } = err.$metadata;
    throw new Error(`s3 put object failed: ${requestId}, ${cfId}, ${extendedRequestId}`);
  }
}

export async function downloadObject(file: string, bucket: string, key: string): Promise<void> {
  let output;
  try {
    output = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));

    if (output.$metadata.httpStatusCode !== 200) {
      throw new Error('code is not 200');
    }
  } catch (err) {
    const { requestId, cfId, extendedRequestId } = err.$metadata;
    throw new Error(`s3 get object failed: ${requestId}, ${cfId}, ${extendedRequestId}`);
  }

  const stream = output.Body as unknown as IncomingMessage; // ReadableStream
  const audioFileStream = fs.createWriteStream(file);
  await pipeline(stream, audioFileStream);
}

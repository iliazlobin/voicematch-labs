import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import youtubedl from 'youtube-dl-exec';
import { S3Client } from '@aws-sdk/client-s3';
import { retrieveYoutubeInfo, YoutubeInfo } from '../utils/youtubedl';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const ydl = youtubedl.create('/usr/local/bin/youtube-dl');

const s3Client = new S3Client({ region: 'us-east-1' });

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  // console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  // console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  const videoHash = event.queryStringParameters?.videoHash;
  const videoUrl = `https://www.youtube.com/watch?v=${videoHash}`;

  console.debug('requesting youtube video info', videoUrl);

  let info: YoutubeInfo;
  try {
    info = await retrieveYoutubeInfo(videoUrl);
  } catch (err) {
    console.error('failed to retrieve youtube video info', err);

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'failed to retrieve youtube video info',
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(info),
  };
};

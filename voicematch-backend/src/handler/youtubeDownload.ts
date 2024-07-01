import { APIGatewayEvent, APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult, Context } from 'aws-lambda';
import { parseInt } from 'lodash';
import { downloadYoutubeAudio, retrieveYoutubeInfo, YoutubeInfo } from '../utils/youtubedl';
import { checkObjectExist, uploadObject } from '../utils/s3';
import { trimMedia } from '../utils/ffmpeg';
import fs from 'fs';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

interface Params {
  videoHash: string;
  mediaDuration?: number;
  trimOffset?: number;
  trimDuration?: number;
}

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  // console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  // console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  let params: Params;
  try {
    params = extractParams(event.queryStringParameters);
  } catch (err) {
    console.error('failed to extract parameters: ', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'failed to extract parameters'
      }),
    };
  }

  console.debug('extracted parameters', params);

  const videoHash = params.videoHash;
  const videoUrl = `https://www.youtube.com/watch?v=${videoHash}`;

  console.debug('youtube url', videoUrl);

  // compute media parameters
  const mediaOffset: number = params.trimOffset !== undefined ? params.trimOffset : 0;
  let mediaDuration: number;
  if (params.trimDuration !== undefined) {
    mediaDuration = params.trimDuration;
  } else if (params.mediaDuration !== undefined) {
    mediaDuration = params.mediaDuration;
  } else {
    let info: YoutubeInfo;
    try {
      info = await retrieveYoutubeInfo(videoUrl);
    } catch (err) {
      console.error('failed to retrieve youtube video info: ', err);

      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'failed to retrieve youtube video info',
        }),
      };
    }
    mediaDuration = info.duration;
  }

  const mediaId = `youtube/${videoHash}-${mediaOffset}_${mediaDuration}`;

  // check if object already exists
  const extension = 'ogg';
  const bucket = 'voicematch-recordings';
  const key = `youtube/${videoHash}-${mediaOffset}_${mediaDuration}.${extension}`;

  console.info('checking if s3 object exists', bucket, key);

  let objectExist = false;
  try {
    objectExist = await checkObjectExist(bucket, key);
  } catch (err) {
    console.error('failed to check s3 object: ', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'failed to check s3 object'
      }),
    };
  }

  if (objectExist) {
    console.info('object already exists: ', bucket, key);

    return {
      statusCode: 200,
      body: JSON.stringify({
        bucket: bucket,
        key: key,
        mediaId: mediaId,
      }),
    };
  }

  const fullAudioFile = `dwl/youtube/${videoHash}.${extension}`;

  if (fs.existsSync(fullAudioFile)) {
    console.debug('found a local cache of youtube audio: ', fullAudioFile);
  } else {
    console.info('downloading youtube audio: ', videoUrl, fullAudioFile);

    try {
      await downloadYoutubeAudio({
        videoUrl: videoUrl,
        audioFile: fullAudioFile,
      });
    } catch (err) {
      console.error('failed to download from youtube: ', err);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'failed to download from youtube'
        }),
      };
    }
  }

  const trimmedAudioFile = `dwl/youtube/${videoHash}-${mediaOffset}_${mediaDuration}.${extension}`;
  if (fs.existsSync(trimmedAudioFile)) {
    console.debug('found a local cache of a trimmed youtube audio: ', trimmedAudioFile);
  } else {
    console.info('trimming audio file: ', fullAudioFile, trimmedAudioFile, mediaOffset, mediaDuration);

    try {
      await trimMedia(fullAudioFile, trimmedAudioFile, mediaOffset, mediaDuration);
    } catch (err) {
      console.error('failed to trim media', err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'failed to trim media'
        }),
      };
    }
  }

  console.info('uploading youtube audio to s3', trimmedAudioFile, bucket, key);

  try {
    await uploadObject(trimmedAudioFile, bucket, key);
  } catch (err) {
    console.error('failed to upload to s3: ', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'failed to upload to s3'
      }),
    };
  }

  console.info('media is downloaded: ', mediaId);

  return {
    statusCode: 200,
    body: JSON.stringify({
      bucket: bucket,
      key: key,
      mediaId: mediaId,
    }),
  };
};

function extractParams(queryStringParameters: APIGatewayProxyEventQueryStringParameters | null): Params {
  if (queryStringParameters === null) {
    throw new Error('missing parameters');
  }

  const videoHash = queryStringParameters.videoHash;
  if (videoHash === undefined) {
    throw new Error('missing videoHash parameter');
  }

  const mediaDurationText = queryStringParameters.mediaDuration;
  const mediaDuration = mediaDurationText !== undefined ? parseInt(mediaDurationText) : undefined;

  const trimOffsetText = queryStringParameters.trimOffset;
  const trimOffset = trimOffsetText !== undefined ? parseInt(trimOffsetText) : undefined;

  const trimDurationText = queryStringParameters.trimDuration;
  const trimDuration = trimDurationText !== undefined ? parseInt(trimDurationText) : undefined;

  return {
    videoHash: videoHash,
    mediaDuration: mediaDuration,
    trimOffset: trimOffset,
    trimDuration: trimDuration,
  };
}

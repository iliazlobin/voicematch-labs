import { APIGatewayEvent, APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult, Context } from 'aws-lambda';
import youtubedl from 'youtube-dl-exec';
import { S3Client, } from '@aws-sdk/client-s3';
import fs from 'fs';
import FfmpegCommand from 'fluent-ffmpeg';
import { parseInt } from 'lodash';
import { evaluatePitch, recognizePhonemes, recognizeWords } from '../services/predictions';
import { linear } from 'everpolate';
import { checkObjectExist, downloadObject } from '../utils/s3';
import { extractMediaInfo, MediaInfo, trimMedia } from '../utils/ffmpeg';

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

interface ExtendedPhoneme {
  phoneme: string;
  time: number;
  startTime: number;
  endTime: number;
  pitchLevel: number;
  startPitchLevel: number;
  endPitchLevel: number;
}

interface Phoneme {
  char: string;
  startTime: number;
  endTime: number;
}

interface Pitch {
  time: number;
  confidence: number;
  pitch: number;
  semitone: number;
}

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

interface Params {
  mediaId: string;
  // mediaDuration?: number;
  processOffset?: number;
  processDuration?: number;
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
        error: 'wrong parameters'
      }),
    };
  }

  console.debug('extracted parameters', params);

  // check if object exists
  const extension = 'ogg';
  const mediaFile = `dwl/${params.mediaId}.${extension}`;
  const bucket = 'voicematch-recordings';
  const key = `${params.mediaId}.${extension}`;

  if (!fs.existsSync(mediaFile)) {
    console.debug('media file does not exist locally, checking in s3 bucket', mediaFile, bucket, key);

    let objectExists = false;
    try {
      objectExists = await checkObjectExist(bucket, key);
    } catch (err) {
      console.error('failed to check if object exists', err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'failed to check if object exists'
        }),
      };
    }

    if (!objectExists) {
      console.warn('media file does not exist', params.mediaId, bucket, key);
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'media does not exist'
        }),
      };
    }

    try {
      await downloadObject(mediaFile, bucket, key);
    } catch (err) {
      console.error('failed to download object', err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'failed to download object'
        }),
      };
    }

    console.debug('media file has been downloaded', mediaFile);
  }

  const offset = params.processOffset ?? 0;

  let trimmedMediaFile: string;
  if (params.processOffset !== undefined || params.processDuration !== undefined) {
    let mediaInfo: MediaInfo;
    try {
      mediaInfo = await extractMediaInfo(mediaFile);
    } catch (err) {
      console.error('failed to extract media info', err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'failed to extract media info'
        }),
      };
    }

    const audioDuration = mediaInfo.duration;

    if (!(audioDuration > 0)) {
      console.error('invalid media for processing with offsets', audioDuration);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'invalid media for processing with offsets'
        }),
      };
    }

    const duration = params.processDuration ?? audioDuration - offset;
    const newFile = `dwl/${params.mediaId}-${offset}_${duration}.${extension}`;

    // trim media
    try {
      console.debug('trimming media', mediaFile, newFile, offset, duration);
      await trimMedia(mediaFile, newFile, offset, duration);
    } catch (err) {
      console.error('failed to trim media', err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'failed to trim media'
        }),
      };
    }

    trimmedMediaFile = newFile;
  }

  const processMediaFile = trimmedMediaFile ?? mediaFile;
  console.info('processing media file', processMediaFile);

  let [words, phonemes, pitches] = [null, null, null];
  try {
    [words, phonemes, pitches] = await Promise.all([
      recognizeWords(fs.createReadStream(processMediaFile)),
      recognizePhonemes(fs.createReadStream(processMediaFile)),
      evaluatePitch(fs.createReadStream(processMediaFile)),
    ]);
  } catch (e) {
    console.error('failed to run inference: ', e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'failed to run inference',
      }),
    };
  }

  const newWords: Word[] = words.map((w) => {
    return {
      word: w.word,
      startTime: w.start_time + offset,
      endTime: w.end_time + offset,
    };
  });
  // console.debug('! newWords: ', newWords);

  const newPhonemes: Phoneme[] = phonemes.map((p) => {
    return {
      word: p.char,
      startTime: p.start_time + offset,
      endTime: p.end_time + offset,
    };
  });
  // console.debug('! newPhonemes: ', newPhonemes);

  const newPitches: Pitch[] = pitches.map((p) => {
    return {
      time: p.time,
      confidence: p.confidence,
      pitch: p.pitch,
      semitone: p.semitone,
    };
  });
  // console.debug('! newPitches: ', newPitches);

  console.info('audio has been processed: ', processMediaFile, offset, words.length, phonemes.length, pitches.length);

  const phonemeSounds = phonemes.map(p => p.char);
  // console.debug('! phonemeSounds: ', phonemeSounds);

  const timestamps = phonemes.map(p => (p.start_time + p.end_time) / 2);
  const startTimestamps = phonemes.map(p => p.start_time);
  const endTimestamps = phonemes.map(p => p.end_time);
  // console.debug('! timestamps: ', timestamps);
  // console.debug('! startTimestamps: ', startTimestamps);
  // console.debug('! endTimestamps: ', endTimestamps);

  const pitchTimestamps = newPitches.map(p => p.time);
  // console.debug('! pitchTimestamps: ', pitchTimestamps);
  const pitchList = newPitches.map(p => p.pitch);
  // console.debug('! pitchList: ', pitchList);

  const pitchLevels = linear(timestamps, pitchTimestamps, pitchList);
  // console.debug('! pitchLevels: ', pitchLevels);
  const startPitchLevels = linear(startTimestamps, pitchTimestamps, pitchList);
  // console.debug('! startPitchLevels: ', startPitchLevels);
  const stopPitchLevels = linear(timestamps, pitchTimestamps, pitchList);
  // console.debug('! stopPitchLevels: ', stopPitchLevels);
  // const semitoneLevels = linear(timestamps, pitchTimestamps, pitchList)
  // const confidenceLevels = linear(timestamps, pitchTimestamps, pitchList)

  // const zipped = zip(phonemes, timestamps, pitchLevels);
  // console.debug('zipped: ', zipped);

  const extendedPhonemes: ExtendedPhoneme[] = [];
  for (const i in phonemeSounds) {
    extendedPhonemes.push({
      phoneme: phonemeSounds[i],
      time: timestamps[i],
      startTime: startTimestamps[i],
      endTime: endTimestamps[i],
      pitchLevel: pitchLevels[i],
      startPitchLevel: startPitchLevels[i],
      endPitchLevel: stopPitchLevels[i],
      // semitone: semitoneLevels[i],
      // confidence: confidenceLevels[i],
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      words: newWords,
      phonemes: extendedPhonemes,
    }),
  };
};

function extractParams(queryStringParameters: APIGatewayProxyEventQueryStringParameters | null): Params {
  if (queryStringParameters === null) {
    throw new Error('missing parameters');
  }

  const mediaId = queryStringParameters.mediaId;
  if (mediaId === undefined) {
    throw new Error('missing mediaId parameter');
  }

  // const mediaDurationText = queryStringParameters.mediaDuration;
  // const mediaDuration = mediaDurationText !== undefined ? parseInt(mediaDurationText) : undefined;

  const processOffsetText = queryStringParameters.processOffset;
  const processOffset = processOffsetText !== undefined ? parseInt(processOffsetText) : undefined;

  const processDurationText = queryStringParameters.processDuration;
  const processDuration = processDurationText !== undefined ? parseInt(processDurationText) : undefined;

  return {
    mediaId: mediaId,
    // mediaDuration: mediaDuration,
    processOffset: processOffset,
    processDuration: processDuration,
  };
}

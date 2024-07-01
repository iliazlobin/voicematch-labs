import axios, { AxiosError, AxiosResponse } from 'axios';

axios.defaults.withCredentials = true;

export async function youtubeInfo(videoHash: string): Promise<YoutubeInfo> {
  let result: AxiosResponse | undefined;

  try {
    result = await axios.get(`http://localhost:3000/youtube/info?videoHash=${videoHash}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (e) {
    if (e instanceof AxiosError) {
      console.debug('failed to request youtube info: axios: ', e);
      throw new Error(`failed to request youtube info: axios: ${e.code}, ${e.message}, ${e.response?.data?.error}`);
    }
    throw new Error(`failed to request youtube info`);
  }
  if (result?.status !== 200) {
    throw new Error(`failed to request youtube info: bad status: ${result?.status}, ${result?.request?.responseURL}`);
  }
  if (result?.data?.errorMessage !== undefined) {
    throw new Error(`failed to request youtube info: error: ${result?.data?.errorMessage}`);
  }

  return result.data;
}

interface YoutubeInfo {
  id: string;
  title: string;
  fulltitle: string;
  description: string;
  duration: number;
  acodec: string;
  ext: string;
  abr: number;
}

interface YoutubeDownloadParams {
  videoHash: string;
  mediaDuration?: number;
  trimOffset?: number;
  trimDuration?: number;
}

export async function youtubeDownload(params: YoutubeDownloadParams) {
  let result: AxiosResponse | undefined;

  try {
    result = await axios.get('http://localhost:3000/youtube/download', {
      params: params,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (e) {
    if (e instanceof AxiosError) {
      console.debug('failed to process audio: axios: ', e);
      throw new Error(`failed to process audio: axios: ${e.code}, ${e.message}, ${e.response?.data?.error}`);
    }
    throw new Error(`failed to process audio`);
  }
  if (result?.status !== 200) {
    throw new Error(`failed to process audio: bad status: ${result?.status}, ${result?.request?.responseURL}`);
  }

  return result.data;
}

interface AudioChart {
  words: Word[];
  phonemes: Phoneme[];
  // pitches: Pitch[];
}

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

interface Phoneme {
  phoneme: string;
  time: number;
  startTime: number;
  endTime: number;
  pitchLevel: number;
  startPitchLevel: number;
  endPitchLevel: number;
}

export interface AudioProcessParams {
  mediaId: string;
  offset?: number;
  duration?: number;
}

export async function audioProcess(params: AudioProcessParams): Promise<AudioChart> {
  let result: AxiosResponse | undefined;

  try {
    result = await axios.get('http://localhost:3000/audio/process', {
      params: params,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (e) {
    if (e instanceof AxiosError) {
      console.debug('failed to process audio: axios: ', e);
      throw new Error(`failed to process audio: axios: ${e.code}, ${e.message}, ${e.response?.data?.error}`);
    }
    throw new Error(`failed to process audio`);
  }
  if (result?.status !== 200) {
    throw new Error(`failed to process audio: bad status: ${result?.status}, ${result?.request?.responseURL}`);
  }

  return result.data;
}

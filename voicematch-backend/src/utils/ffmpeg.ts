import FfmpegCommand, { ffprobe, FfprobeData } from 'fluent-ffmpeg';

export interface MediaInfo {
  duration: number;
}

export async function extractMediaInfo(file: string): Promise<MediaInfo> {
  let err: Error | null = null;
  let metadata: FfprobeData | null = null;

  console.trace('running ffprobe');

  ffprobe(file, (e, data) => {
    err = e;
    metadata = data;
  });

  const timeout = 20;
  for (let i = 0; i < timeout; i++) {
    await new Promise(r => setTimeout(r, 10));
    if (i === timeout) {
      err = new Error('timeout');
      break;
    }
    if (err !== null || metadata !== null) {
      console.trace('ffprobe loop exit', i * 10, err);
      break;
    }
  }

  if (err !== null) {
    throw new Error(`failed to get metadata for audio file: ${err}`);
  }

  return {
    duration: metadata.format.duration,
  };
}

export async function trimMedia(file: string, newFile: string, offset: number, duration?: number): Promise<MediaInfo> {
  let err: Error | null = null;
  let finished = false;

  const command = FfmpegCommand({ logger: console });
  command.input(file);
  if (offset > 0) {
    command.seekInput(offset);
  }
  if (duration !== undefined) {
    command.duration(duration);
  }

  command.output(newFile)
    .on('start', (cmdline) => {
      console.debug('! ffmpeg cmdline: ', cmdline);
    })
    .on('error', function (e) {
      err = e;
    })
    .on('end', function () {
      finished = true;
    })
    .run();

  const timeout = 50;
  for (let i = 0; i < timeout; i++) {
    await new Promise(r => setTimeout(r, 10));
    if (i === timeout) {
      err = new Error('timeout');
      break;
    }
    if (err !== null || finished) {
      console.debug('ffmpeg loop exit', i * 10, err, finished);
      break;
    }
  }

  if (err !== null) {
    throw new Error(`failed to trim audio file: ${err}`);
  }
}

import youtubedl from 'youtube-dl-exec';

const ydl = youtubedl.create('/usr/local/bin/youtube-dl');

export interface YoutubeInfo {
  id: string;
  title: string;
  fulltitle: string;
  description: string;
  duration: number;
  acodec: string;
  ext: string;
  abr: number;
}

export async function retrieveYoutubeInfo(url: string): Promise<YoutubeInfo> {
  const result = await ydl.exec(url, {
    dumpJson: true,
    skipDownload: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`ydl error: ${result.stderr}`);
  }

  const allInfo = JSON.parse(result.stdout as string) as YoutubeInfo;

  const info = {
    id: allInfo.id,
    title: allInfo.title,
    fulltitle: allInfo.fulltitle,
    description: allInfo.description,
    duration: allInfo.duration,
    acodec: allInfo.acodec,
    ext: allInfo.ext,
    abr: allInfo.abr,
  };

  return info;
}

export async function downloadYoutubeAudio({
  videoUrl,
  audioFile,
}: {
  videoUrl: string,
  audioFile: string,
}): Promise<void> {
  console.debug('running youtube-dl: ', videoUrl, audioFile);

  const result = await ydl.exec(videoUrl, {
    output: audioFile,
    extractAudio: true,
    audioFormat: 'vorbis',
    // TODO: video isn't trimmed: https://www.youtube.com/watch?v=uhPKBN6vlk4
    // postprocessorArgs: args,
  });

  if (result.exitCode !== 0) {
    throw new Error(`ydl error: ${result.stderr}`);
  }
}

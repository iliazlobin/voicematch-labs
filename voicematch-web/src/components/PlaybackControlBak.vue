<template>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="scenePlot" id="selectPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" justify="space-between" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-slider v-model="balanceLevel" class="pt-8 pl-8" min="-1" max="1" step="0.1" thumb-label="always"
          thumb-size="14" hide-details @dblclick="e => resetBalanceLevel()"></v-slider>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => restartBoth()"
          :disabled="!canPlay">
          <v-icon icon="mdi-step-forward-2" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg"
          @click.prevent="e => canPause ? pause() : playBoth()" :disabled="!canPlay">
          <v-icon :icon="canPause ? 'mdi-pause' : 'mdi-fast-forward'" size="x-large"></v-icon>
          <!-- <v-icon icon="mdi-pause" size="x-large"></v-icon> -->
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => process()"
          :disabled="!canPlay">
          <v-icon icon="mdi-tray-arrow-up" size="x-large"></v-icon>
        </v-btn>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <!-- <v-slider v-model="sceneZoom" class="pt-8 pr-8" min="-100" max="100" thumb-label="always"
          thumb-size="14" hide-details @dblclick="e => resetSceneZoom()"></v-slider> -->
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" justify="space-between" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-slider v-model="volumeLevel" class="pt-8 pl-8" min="0" max="100" step="1" thumb-label="always" thumb-size="14"
          hide-details @dblclick="e => resetVolumeLevel()"></v-slider>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => restart()"
          :disabled="!canPlay">
          <v-icon icon="mdi-step-forward" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => canPause ? pause() : play()"
          :disabled="!canPlay">
          <v-icon :icon="canPause ? 'mdi-pause' : 'mdi-play'" size="x-large"></v-icon>
          <!-- <v-icon icon="mdi-pause" size="x-large"></v-icon> -->
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => stop()"
          :disabled="!canStop">
          <v-icon icon="mdi-stop" size="x-large"></v-icon>
        </v-btn>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-slider v-model="playbackRate" class="pt-8 pr-8" min="0.1" max="1.5" step="0.1" thumb-label="always"
          thumb-size="14" hide-details @dblclick="e => resetPlaybackRate()"></v-slider>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="selectPlot" id="navPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { usePlot } from '@/modules/plot.js';
import { processAudio } from '@/services/downloads';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Plotly from 'plotly.js-dist';
import * as Tone from 'tone';
import { computed, ref, watch, watchEffect } from 'vue';
import colors from 'vuetify/lib/util/colors';
import WaveformData from 'waveform-data';

const props = defineProps(['audioBlob', 'sourceAudioChart'])
const emit = defineEmits(['update:controlPlay', 'update:conrtolBalanceLevel', 'update:controlPlaybackRate'])

const playheadSelect = ref({ start: 0, end: 0 });
const playheadPosition = ref(0);

const audioChart = ref();
const sourceAudioChart = computed(() => props.sourceAudioChart);

const scenePlot = ref();
const sceneData = ref();
const selectPlot = ref();
const selectData = ref();
const selectTrack = ref();
const dragTrack = ref();
const yaxisRange = [-0.05, 2.1];
const navYaxisRange = [-100, 100];
usePlot({ plot: scenePlot, data: sceneData, height: 500, yaxisRange: yaxisRange, dragmode: 'pan', navigateEvent: dragTrack, resetEvent: dragTrack, scrollControl: selectTrack, preventDataChangeNavigation: true });
usePlot({ plot: selectPlot, data: selectData, navigateEvent: selectTrack, resetEvent: selectTrack, navigateControl: dragTrack });

const audioBlob = computed(() => props.audioBlob);
const loadedAudioBlob = ref(null);

// player controls
let mediaPlayer = null;
let playingDrawCancel = null;
const defaultPlaybackRate = 1;
const playbackRate = ref(defaultPlaybackRate);
let newPlaybackRate = defaultPlaybackRate;
const shiftPitch = new Tone.PitchShift(1);
const defaultVolumeLevel = 100;
const volumeLevel = ref(defaultVolumeLevel);
let newVolume = 0;
const balanceLevel = ref(0);
let previousPosition = 0;

function resetVolumeLevel() {
  volumeLevel.value = defaultVolumeLevel;
}
function resetPlaybackRate() {
  playbackRate.value = defaultPlaybackRate;
}
function resetBalanceLevel() {
  balanceLevel.value = 0;
}

// // zoom
// const defaultSceneZoom = 0;
// const sceneZoom = ref(defaultSceneZoom);

// watch(sceneZoom, (zoom) => {
//   // sceneZoom.value = defaultSceneZoom;
// });

// player ui
const playerInitialized = ref(false);
const mediaPlaying = ref(false);
const mediaEnded = ref(true);

const canReplay = computed(() => {
  return playerInitialized.value
})
const canPlay = computed(() => {
  return playerInitialized.value
})
const canPause = computed(() => {
  return mediaPlaying.value && !mediaEnded.value
})
const canStop = computed(() => {
  return playerInitialized.value
})

watchEffect(() => {
  if (selectTrack.value?.x0 !== undefined && selectTrack.value?.x1 !== undefined) {
    playheadSelect.value = {
      start: selectTrack.value.x0,
      end: selectTrack.value.x1,
    }
  }
});

watchEffect(() => {
  if (dragTrack.value?.x0 !== undefined && dragTrack.value?.x1 !== undefined) {
    playheadSelect.value = {
      start: dragTrack.value.x0,
      end: dragTrack.value.x1,
    }
  }
});

watchEffect(() => {
  playheadSelect.value = {
    start: 0,
    end: loadedAudioBlob.value?.duration ?? 0,
  }
});

watchEffect(() => {
  emit('update:conrtolBalanceLevel', balanceLevel.value);
});

watchEffect(() => {
  emit('update:controlPlaybackRate', playbackRate.value);
});

watch([volumeLevel, balanceLevel], ([volume, balance]) => {
  const balanceCoef = balance < 0 ? 1 - (-1) * balance : 1;
  const volumeValue = volume * balanceCoef;

  if (volumeValue > 0) {
    newVolume = Math.log(volumeValue / 100) / Math.log(1.06);
  } else {
    newVolume = -999;
  }

  // console.debug('! playback volumeLevel: ', volume, balance, balanceCoef, volumeValue, newVolume);

  if (mediaPlayer !== null) {
    mediaPlayer.volume.value = newVolume;
  }
}, { immediate: true });

watch(playbackRate, () => {
  newPlaybackRate = playbackRate.value;
  shiftPitch.pitch = 12 * Math.log2(1 / playbackRate.value);

  if (mediaPlayer !== null) {
    mediaPlayer.playbackRate = newPlaybackRate;
  }
}, { immediate: true });

watch(audioBlob, blob => {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
    mediaPlayer.dispose();
  }

  mediaPlayer = new Tone.Player(blob.url, onload = () => {
    const timestamp = Date.now();
    loadedAudioBlob.value = { ...blob, duration: mediaPlayer.buffer.duration, timestamp: timestamp };
  })
});

watch(() => loadedAudioBlob.value, (b) => {
  console.info('playback audio loaded: ', b, newVolume, newPlaybackRate);

  mediaPlayer.connect(shiftPitch);
  shiftPitch.toDestination();

  mediaPlayer.volume.value = newVolume;
  mediaPlayer.playbackRate = newPlaybackRate;

  mediaPlayer.onstop = () => {
    window.cancelAnimationFrame(playingDrawCancel);

    const now = mediaPlayer.immediate();
    const delta = now - previousPosition;
    const stoppedAt = playheadPosition.value + delta * playbackRate.value;

    // console.debug('! media player stopped at: ', stoppedAt, mediaPlayer.buffer.duration)

    mediaPlaying.value = false;

    if (mediaPlayer.buffer.duration - stoppedAt < 0.01) {
      playheadPosition.value = 0;
      mediaEnded.value = true;
      emit('update:controlPlay', {
        action: "stop",
      });
    }
    // else {
    //   emit('update:controlPlay', {
    //     action: "pause",
    //   });
    // }
  }

  playerInitialized.value = true;
})

function stop() {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
  window.cancelAnimationFrame(playingDrawCancel);
  playheadPosition.value = 0;

  mediaPlaying.value = false;
  mediaEnded.value = true;
}

function restart() {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
  playheadPosition.value = 0;
  play();
}

function play() {
  if (canPlay.value !== true) {
    return
  }

  if (playheadSelect.value?.start !== undefined && playheadSelect.value?.end !== undefined) {
    if (playheadPosition.value < playheadSelect.value.start || playheadPosition.value > playheadSelect.value.end) {
      playheadPosition.value = playheadSelect.value.start
    }
  }

  let playDuration;
  if (playheadSelect.value?.end !== undefined) {
    if (playheadSelect.value.end > playheadPosition.value) {
      playDuration = playheadSelect.value.end - playheadPosition.value;
    }
  }

  console.debug('! start playing playback: ', playheadSelect.value?.start, playheadSelect.value?.end, playheadPosition.value, playDuration, playbackRate.value)

  previousPosition = mediaPlayer.immediate();
  mediaPlayer.start(0, playheadPosition.value, playDuration);

  drawPosition();

  mediaEnded.value = false;
  mediaPlaying.value = true;
}

function playBoth() {
  let offset = 0;
  if (playheadSelect.value?.start !== undefined && playheadSelect.value?.end !== undefined) {
    if (playheadPosition.value < playheadSelect.value.start || playheadPosition.value > playheadSelect.value.end) {
      offset = playheadSelect.value.start
    }
  }
  let duration;
  if (playheadSelect.value?.end !== undefined) {
    if (playheadSelect.value.end > playheadPosition.value) {
      duration = playheadSelect.value.end - playheadPosition.value
    }
  }

  emit('update:controlPlay', {
    action: "play",
    offset: offset,
    duration: duration,
  });
  play();
}

let selectedRegionShape;
let playheadLineShape;

watch(dragTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const selectedRect = {
    line: {
      width: 1,
    },
    type: "rect",
    xref: "x",
    x0: x0,
    y0: navYaxisRange[0],
    yref: "y",
    x1: x1,
    y1: navYaxisRange[1],
    fillcolor: "rgb(225, 236, 225)",
    opacity: 0.5,
  };
  selectedRegionShape = selectedRect;

  const newShapes = [selectedRect];
  if (playheadLineShape !== undefined) {
    newShapes.push(playheadLineShape);
  }
  Plotly.relayout(selectPlot.value, { shapes: newShapes });
});

watch(selectTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const newShapes = [];
  if (playheadLineShape !== undefined) {
    newShapes.push(playheadLineShape);
  }
  Plotly.relayout(selectPlot.value, { shapes: newShapes });
});

function drawPosition() {
  playingDrawCancel = requestAnimationFrame(drawPosition);

  const now = mediaPlayer.immediate();
  const delta = now - previousPosition;
  const newPosition = playheadPosition.value + delta * playbackRate.value;
  previousPosition = now;

  if (scenePlot.value !== undefined && sceneData.value !== undefined) {
    const playheadLine = {
      line: { color: colors.orange.darken2, width: 2 },
      type: "line",
      x0: newPosition,
      x1: newPosition,
      xref: "x",
      y0: yaxisRange[0],
      y1: yaxisRange[1],
      yref: "y",
    };
    Plotly.relayout(scenePlot.value, { shapes: [playheadLine] });
  }
  if (selectPlot.value !== undefined) {
    const playheadLine = {
      line: { color: colors.orange.darken2, width: 2 },
      type: "line",
      x0: newPosition,
      x1: newPosition,
      xref: "x",
      y0: navYaxisRange[0],
      y1: navYaxisRange[1],
      yref: "y",
    };
    playheadLineShape = playheadLine;
    const newShapes = [playheadLine];
    if (selectedRegionShape !== undefined) {
      newShapes.push(selectedRegionShape);
    }
    Plotly.relayout(selectPlot.value, { shapes: newShapes });
  }

  playheadPosition.value = newPosition;
};

function pause() {
  emit('update:controlPlay', {
    action: "pause",
  });
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
}



function restartBoth() {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
  playheadPosition.value = 0;

  let offset = 0;
  if (playheadSelect.value?.start !== undefined) {
    offset = playheadSelect.value.start
  }
  let duration;
  if (playheadSelect.value?.end !== undefined) {
    if (playheadSelect.value.end > playheadPosition.value) {
      duration = playheadSelect.value.end - playheadPosition.value
    }
  }

  emit('update:controlPlay', {
    action: "restart",
    offset: offset,
    duration: duration,
  });
  restart();
}

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_AWS_ACCESS_SECRET_KEY,
  },
  tls: false,
});

async function process() {
  const { blob, duration, timestamp } = loadedAudioBlob.value;
  const bucket = import.meta.env.VITE_BUCKET_NAME;
  const key = `uploads/${timestamp}.ogg`;

  console.debug('processing playback audio: ', timestamp, bucket, key, blob, duration);

  let objectExist = false;
  try {
    const output = await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    // console.debug('! head output: ', output);
    objectExist = true;
  } catch (err) {
    console.debug('! err: ', err);
    if (err.name === 'NotFound') {
      console.debug('key not found, continuing', bucket, key);
    } else {
      const { requestId, cfId, extendedRequestId } = err.$metadata;
      console.error('failed to check s3', err, requestId, cfId, extendedRequestId);
      return false;
    }
  }

  if (!objectExist) {
    console.debug('object does not exist, uploading', bucket, key, blob);

    try {
      const output = await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Body: blob,
        Key: key,
      }));
      // console.debug('! put output: ', output);
    } catch (err) {
      const { requestId, cfId, extendedRequestId } = err.$metadata;
      console.error('failed to upload to s3', err, requestId, cfId, extendedRequestId);
      return;
    }
  }

  const chart = await processAudio({
    uploadId: timestamp,
  });

  console.debug('playback audio chart updated: ', chart);
  audioChart.value = chart;
}

watch([audioChart, sourceAudioChart], ([playbackChart, sourceChart]) => {
  console.debug('! audio charts changed: ', playbackChart, sourceChart);

  const allTraces = [];

  if (playbackChart !== undefined) {
    const words = playbackChart.words;
    const phonemes = playbackChart.phonemes;

    const phonemeTraces = phonemes.map(p => ({
      x: [p.startTime, p.time, p.endTime],
      y: [p.startPitchLevel, p.pitchLevel, p.endPitchLevel],
      mode: 'lines+text',
      // type: 'scatter',
      text: ["", p.phoneme, ""],
      textposition: 'top center',
      line: {
        color: colors.cyan.lighten1,
        width: 3,
      },
      textfont: {
        family: 'Roboto',
        size: 18,
        color: colors.blue.lighten1,
      },
    }))
    // console.debug('phonemeTraces: ', phonemeTraces);
    allTraces.push(...phonemeTraces);

    const wordsTraces = [];
    words.forEach((word, index) => {
      const trace = {
        x: [word.startTime, (word.startTime + word.endTime) / 2, word.endTime],
        y: [0, 0, 0],
        mode: 'lines+text',
        // type: 'scatter',
        text: ["", word.word, ""],
        textposition: 'top center',
        line: {
          color: colors.cyan.lighten1,
          width: 3,
        },
        textfont: {
          family: 'Roboto',
          size: 14,
          color: colors.blue.lighten1,
        },
      };
      wordsTraces.push(trace);
    });

    allTraces.push(...wordsTraces);
  }

  if (sourceChart !== undefined) {
    const words = sourceChart.words;
    const phonemes = sourceChart.phonemes;
    const offset = sourceChart.offset;
    const duration = sourceChart.duration;

    const phonemeTraces = phonemes.map(p => {
      const startTime = offset !== undefined ? p.startTime - offset : p.startTime;
      const time = offset !== undefined ? p.time - offset : p.time;
      const endTime = offset !== undefined ? p.endTime - offset : p.endTime;

      if (startTime < 0) {
        return null;
      }
      if (duration !== undefined && endTime > duration) {
        return null;
      }

      // console.debug('! phoneme: ', p, startTime, time, endTime, offset, duration);

      return {
        x: [startTime, time, endTime],
        y: [p.startPitchLevel + 1.0, p.pitchLevel + 1.0, p.endPitchLevel + 1.0],
        mode: 'lines+text',
        // type: 'scatter',
        text: ["", p.phoneme, ""],
        textposition: 'top center',
        line: {
          color: colors.orange.lighten1,
          width: 3,
        },
        textfont: {
          family: 'Roboto',
          size: 18,
          color: colors.brown.lighten1,
        },
      }
    }).filter(p => p !== null);

    console.debug('! phonemeTraces: ', phonemeTraces);
    allTraces.push(...phonemeTraces);

    const wordsTraces = words.map(w => {
      const startTime = offset !== undefined ? w.startTime - offset : w.startTime;
      const endTime = offset !== undefined ? w.endTime - offset : w.endTime;

      if (startTime < 0) {
        return null;
      }
      if (duration !== undefined && endTime > duration) {
        return null;
      }

      console.debug('! word: ', w, startTime, endTime, offset, duration);

      const time = (startTime + endTime) / 2;

      return {
        x: [startTime, time, endTime],
        y: [2, 2, 2],
        mode: 'lines+text',
        // type: 'scatter',
        text: ["", w.word, ""],
        textposition: 'top center',
        line: {
          color: colors.orange.lighten1,
          width: 3,
        },
        textfont: {
          family: 'Roboto',
          size: 14,
          color: colors.brown.lighten1,
        },
      };
    }).filter(w => w !== null);

    console.debug('! wordsTraces: ', wordsTraces);
    allTraces.push(...wordsTraces);
  }

  console.debug('! allTraces: ', allTraces, allTraces.length);

  sceneData.value = {
    traces: allTraces,
    duration: loadedAudioBlob.value?.duration,
  }
})

watch(loadedAudioBlob, (b) => {
  redrawPlot(b.blob, b.duration)
})

async function redrawPlot(blob, duration) {

  const reader = new FileReader();
  reader.addEventListener("loadend", () => {
    const arrayBuffer = reader.result

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const options = {
      audio_context: audioContext,
      array_buffer: arrayBuffer,
      scale: 480
    }

    WaveformData.createFromAudio(options, (err, waveform) => {
      if (err) {
        console.error(`Error creating waveform: ${err}`);
        return
      }
      // console.debug(`Waveform created: ${waveform.duration} seconds, ${waveform.length} samples, ${waveform.channels.length} channels`);

      const channel = waveform.channel(0);

      const samplesX = []
      for (let x = 0; x < waveform.length; x++) {
        samplesX.push(x / 100)
      }

      const maxSamplesY = []
      for (let x = 0; x < waveform.length; x++) {
        const val = channel.max_sample(x);
        maxSamplesY.push(val)
      }

      const minSamplesY = []
      for (let x = 0; x < waveform.length; x++) {
        const val = channel.min_sample(x);
        minSamplesY.push(val)
      }

      const traces = [{
        x: samplesX,
        y: maxSamplesY,
        type: 'bar',
        // mode: 'lines',
        marker: {
          color: 'rgb(219, 64, 82)',
          // size: 12
        },
      }, {
        x: samplesX,
        y: minSamplesY,
        type: 'bar',
        // mode: 'lines',
        marker: {
          color: 'rgb(219, 64, 82)',
          // size: 12
        },
      }]

      selectData.value = {
        traces: traces,
        duration: duration,
      }
    })
  });

  reader.readAsArrayBuffer(blob);
}

</script>

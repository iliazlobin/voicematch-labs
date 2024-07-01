<template>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="selectPlot" id="selectPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="scenePlot" id="scenePlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" justify="space-between" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="3">
        <v-slider v-model="playbackRate" class="pt-8 pl-2 pr-0" min="0.1" max="1.5" step="0.1" thumb-label="always"
          thumb-size="14" hide-details @dblclick="e => resetPlaybackRate()" v-show="!recordingIndicator"
          :disabled="!((tapePlayerLoaded && tapeTrack) || (sourcePlayerLoaded && sourceTrack))"></v-slider>
        <v-sheet color="transparent" class="pt-1 pl-2" align="baseline" v-show="recordingIndicator">
          <canvas ref="canvasElem" class="visualizer" width="180" height="50"></canvas>
        </v-sheet>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="6">
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg"
          @click.prevent="e => recordingInProgress ? stopRecording() : startRecording()">
          <v-icon :icon="!recordingInProgress ? 'mdi-record' : 'mdi-stop'" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => tapePlay()"
          :disabled="recordingInProgress || !(tapePlayerLoaded && tapeTrack)">
          <v-icon icon="mdi-step-forward" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => bothStop()"
          :disabled="!tapeMediaPlaying && !sourceMediaPlaying">
          <v-icon icon='mdi-stop' size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => sourcePlay()"
          :disabled="recordingInProgress || !(sourcePlayerLoaded && sourceTrack)">
          <v-icon icon="mdi-step-forward-2" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => bothPlay()"
          :disabled="recordingInProgress || !(tapePlayerLoaded && tapeTrack && sourcePlayerLoaded && sourceTrack)">
          <v-icon icon="mdi-fast-forward" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" @click.prevent="e => bothPlay()" disabled="true">
          <v-icon icon="mdi-content-save" size="x-large"></v-icon>
        </v-btn>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="3">
        <v-slider v-model="balanceLevel" class="pt-8 pl-0 pr-2" min="-1" max="1" step="0.1" thumb-label="always"
          thumb-size="14" hide-details @dblclick="e => resetBalanceLevel()"
          :disabled="!(tapePlayerLoaded && tapeTrack && sourcePlayerLoaded && sourceTrack)"></v-slider>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="sourceNavPlot" id="sourceNavPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="sourceZoomPlot" id="sourceZoomPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { usePlot } from '@/modules/plot.js';
import { audioProcess } from '@/services/downloads';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Plotly from 'plotly.js-dist';
import * as Tone from 'tone';
import { computed, ref, watch, watchEffect } from 'vue';
import colors from 'vuetify/lib/util/colors';
import WaveformData from 'waveform-data';

const props = defineProps(['audioBlob', 'sourceAudioBlob'])
// const emit = defineEmits(['update:controlPlay', 'update:conrtolBalanceLevel', 'update:controlPlaybackRate'])
const emit = defineEmits()

// recording
let mediaRecorder = null;
const recordingIndicator = ref(false);
const recordingInProgress = ref(false);

const canvasElem = ref(null);
let recordingAnimationCancel = null;
let audioAnalyser;
let bufferLength;
let dataArray;
let cvs;
let width;
let height;

// tape
const tapeAudioBlob = ref();
watchEffect(() => {
  tapeAudioBlob.value = props.audioBlob;
});
const tapeLoadedAudioBlob = ref();

const scenePlot = ref();
const sceneData = ref();
const selectPlot = ref();
const selectData = ref();
const tapeResetTrack = ref();
const tapeSelectTrack = ref();
const tapeDragTrack = ref();
const sceneRange = [-0.05, 2.1];
const navRange = [-100, 100];
usePlot({ plot: selectPlot, data: selectData, navigateEvent: tapeSelectTrack, resetEvents: [tapeSelectTrack, tapeResetTrack], navigateControl: tapeDragTrack });
usePlot({ plot: scenePlot, data: sceneData, height: 500, yaxisRange: sceneRange, dragmode: 'pan', navigateEvent: tapeDragTrack, resetEvents: [tapeDragTrack], scrollControl: tapeSelectTrack, preventDataChangeNavigation: true });

let tapeSelectedRegionShape;
let tapePlayheadLineShape;

const tapeTrack = ref();
// watchEffect(() => {
//   if (!(sceneData.value?.duration !== undefined)) {
//     return;
//   }
//   tapeTrack.value = [0, sceneData.value.duration];
// });
watchEffect(() => {
  if (!(tapeSelectTrack.value?.x0 !== undefined && tapeSelectTrack.value?.x1 !== undefined)) {
    return;
  }
  tapeTrack.value = [tapeSelectTrack.value.x0, tapeSelectTrack.value.x1];
});
watchEffect(() => {
  if (!(tapeDragTrack.value?.x0 !== undefined && tapeDragTrack.value?.x1 !== undefined)) {
    return;
  }
  tapeTrack.value = [tapeDragTrack.value.x0, tapeDragTrack.value.x1];
});
watch(tapeResetTrack, track => {
  tapeSelectedRegionShape = [];
});

watchEffect(() => {
  tapeTrack.value = tapeSelectTrack.value;
});
watchEffect(() => {
  tapeTrack.value = tapeDragTrack.value;
});
// watchEffect(() => {
//   console.debug('! tapeSelectTrack: ', tapeSelectTrack.value);
// });
// watchEffect(() => {
//   console.debug('! tapeDragTrack: ', tapeDragTrack.value);
// });
watchEffect(() => {
  console.debug('! tapeTrack: ', tapeTrack.value);
});

let tapeMediaPlayer = null;
let tapeDrawPositionCancel = null;
let tapePlayheadPosition = 0;
let tapePlayOffset = 0;
let tapePreviousPosition = 0;

const tapePlayerLoaded = ref(false);
const tapeMediaPlaying = ref(false);

const tapeAudioChart = ref();

// source
const sourceAudioBlob = computed(() => props.sourceAudioBlob);
const sourceLoadedAudioBlob = ref();

const sourceZoomPlot = ref();
const sourceZoomData = ref();
const sourceNavPlot = ref();
const sourceNavData = ref();
const sourceResetTrack = ref();
const sourceSelectTrack = ref();
const sourceDragTrack = ref();
usePlot({ plot: sourceNavPlot, data: sourceNavData, navigateEvent: sourceDragTrack, resetEvents: [sourceDragTrack], scrollControl: sourceSelectTrack, useDefaultDuration: true, dragmode: 'pan' });
usePlot({ plot: sourceZoomPlot, data: sourceZoomData, navigateEvent: sourceSelectTrack, resetEvents: [sourceSelectTrack, sourceResetTrack], navigateControl: sourceDragTrack });

let sourceSelectedRegionShape;
let sourcePlayheadLineShape;

const sourceTrack = ref();
watchEffect(() => {
  if (!(sourceNavData.value?.duration !== undefined)) {
    return;
  }
  sourceTrack.value = [0, sourceNavData.value.duration];
});
watchEffect(() => {
  if (!(sourceSelectTrack.value?.x0 !== undefined && sourceSelectTrack.value?.x1 !== undefined)) {
    return;
  }
  sourceTrack.value = [sourceSelectTrack.value.x0, sourceSelectTrack.value.x1];
});
watchEffect(() => {
  if (!(sourceDragTrack.value?.x0 !== undefined && !sourceDragTrack.value?.x1 !== undefined)) {
    return;
  }
  sourceTrack.value = [sourceDragTrack.value.x0, sourceDragTrack.value.x1];
});
watch(sourceResetTrack, track => {
  sourceSelectedRegionShape = [];
});

// watchEffect(() => {
//   console.debug('! sourceSelectTrack: ', sourceSelectTrack.value);
// });
// watchEffect(() => {
//   console.debug('! sourceDragTrack: ', sourceDragTrack.value);
// });
watchEffect(() => {
  console.debug('! sourceTrack: ', sourceTrack.value);
});

let sourceMediaPlayer = null;
let sourceDrawPositionCancel = null;
let sourcePlayheadPosition = 0;
let sourcePlayOffset = 0;
let sourcePreviousPosition = 0;

const sourcePlayerLoaded = ref(false);
const sourceMediaPlaying = ref(false);

const sourceAudioChart = ref();

// controls
const defaultPlaybackRate = 1;
const playbackRate = ref(defaultPlaybackRate);
let newPlaybackRate = defaultPlaybackRate;

const shiftPitch = new Tone.PitchShift(1);

const defaultVolumeLevel = 100;
const tapeVolumeLevel = ref(defaultVolumeLevel);
const sourceVolumeLevel = ref(defaultVolumeLevel);

let newVolume = 0;
const balanceLevel = ref(0);

function resetTapeVolumeLevel() {
  tapeVolumeLevel.value = defaultVolumeLevel;
}
function resetSourceVolumeLevel() {
  sourceVolumeLevel.value = defaultVolumeLevel;
}
function resetPlaybackRate() {
  playbackRate.value = defaultPlaybackRate;
}
function resetBalanceLevel() {
  balanceLevel.value = 0;
}

// effects

// watchEffect(() => {
//   emit('update:conrtolBalanceLevel', balanceLevel.value);
// });

// watchEffect(() => {
//   emit('update:controlPlaybackRate', playbackRate.value);
// });

watch([tapeVolumeLevel, balanceLevel], ([volume, balance]) => {
  if (tapeMediaPlayer !== null) {
    tapeMediaPlayer.volume.value = calculateTapeMediaVolue(volume, balance);
  }
}, { immediate: true });

function calculateTapeMediaVolue(volume, balance) {
  const coef = balance > 0 ? 1 - balance : 1;
  const value = volume * coef;

  if (value > 0) {
    newVolume = Math.log(value / 100) / Math.log(1.06);
  } else {
    newVolume = -999;
  }

  return newVolume
}

watch([sourceVolumeLevel, balanceLevel], ([volume, balance]) => {
  if (sourceMediaPlayer !== null) {
    sourceMediaPlayer.volume.value = calculateSourceMediaVolue(volume, balance);
  }
}, { immediate: true });

function calculateSourceMediaVolue(volume, balance) {
  const coef = balance < 0 ? 1 - (-1) * balance : 1;
  const value = volume * coef;

  if (value > 0) {
    newVolume = Math.log(value / 100) / Math.log(1.06);
  } else {
    newVolume = -999;
  }

  return newVolume
}

watch(playbackRate, () => {
  newPlaybackRate = playbackRate.value;
  shiftPitch.pitch = 12 * Math.log2(1 / playbackRate.value);

  if (tapeMediaPlayer !== null) {
    tapeMediaPlayer.playbackRate = newPlaybackRate;
  }
  if (sourceMediaPlayer !== null) {
    sourceMediaPlayer.playbackRate = newPlaybackRate;
  }
}, { immediate: true });

// tape
watch(tapeDragTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const selectedRect = {
    line: {
      width: 1,
    },
    type: "rect",
    xref: "x",
    x0: x0,
    y0: navRange[0],
    yref: "y",
    x1: x1,
    y1: navRange[1],
    fillcolor: "rgb(225, 236, 225)",
    opacity: 0.5,
  };
  tapeSelectedRegionShape = selectedRect;

  const newShapes = [selectedRect];
  if (tapePlayheadLineShape !== undefined) {
    newShapes.push(tapePlayheadLineShape);
  }
  Plotly.relayout(selectPlot.value, { shapes: newShapes });
});

watch(tapeSelectTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const newShapes = [];
  if (tapePlayheadLineShape !== undefined) {
    newShapes.push(tapePlayheadLineShape);
  }
  Plotly.relayout(selectPlot.value, { shapes: newShapes });
});

watch(tapeAudioBlob, blob => {
  if (tapeMediaPlayer !== null) {
    tapeMediaPlayer.stop();
    tapeMediaPlayer.dispose();
  }

  tapeMediaPlayer = new Tone.Player(blob.url, onload = () => {
    tapeMediaPlayer.volume.value = calculateTapeMediaVolue(tapeVolumeLevel.value, balanceLevel.value);
    const timestamp = Date.now();
    const loadedBlob = { ...blob, duration: tapeMediaPlayer.buffer.duration, timestamp: timestamp };
    tapeLoadedAudioBlob.value = loadedBlob;
    tapeExtractAudioChart(loadedBlob);
  })
});

watch(tapeLoadedAudioBlob, blob => {
  console.info('tape audio loaded: ', blob, newVolume, newPlaybackRate);

  tapeMediaPlayer.connect(shiftPitch);
  shiftPitch.toDestination();

  tapeMediaPlayer.volume.value = newVolume;
  tapeMediaPlayer.playbackRate = newPlaybackRate;

  tapeMediaPlayer.onstop = () => {
    window.cancelAnimationFrame(tapeDrawPositionCancel);

    if (tapePlayheadPosition > 0.1) {
      tapeClearPlayhead();
      tapeMediaPlaying.value = false;
    }
  }

  tapePlayerLoaded.value = true;
})

watch(tapeLoadedAudioBlob, (b) => {
  tapeRenderWaveform(b.blob, b.duration)
})

async function tapeRenderWaveform(blob, duration) {

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

function tapeStop() {
  window.cancelAnimationFrame(tapeDrawPositionCancel);
  tapeClear();
  tapeMediaPlaying.value = false;
}

function tapeClear() {
  if (tapeMediaPlayer !== null) {
    tapeMediaPlayer.stop();
  }
  tapeClearPlayhead();
}

function tapeClearPlayhead() {
  if (scenePlot.value !== undefined) {
    Plotly.relayout(scenePlot.value, { shapes: [] });
  }
  if (selectPlot.value !== undefined) {
    const newShapes = [];
    if (tapeSelectedRegionShape !== undefined) {
      newShapes.push(tapeSelectedRegionShape);
    }
    Plotly.relayout(selectPlot.value, { shapes: newShapes });
  }
}

function tapePlay() {
  tapeClear();
  sourceClear();

  tapePlayOffset = tapeTrack.value[0];
  const duration = tapeTrack.value[1] - tapePlayOffset;
  tapePreviousPosition = tapeMediaPlayer.immediate();
  tapePlayheadPosition = tapePlayOffset;

  console.debug('! playing tape: ', tapeTrack.value, tapePlayOffset, duration, tapePreviousPosition, playbackRate.value)
  tapeMediaPlayer.start(0, tapePlayOffset, duration);;

  tapeDrawPosition();

  tapeMediaPlaying.value = true;
}

function tapeDrawPosition() {
  tapeDrawPositionCancel = requestAnimationFrame(tapeDrawPosition);

  const now = tapeMediaPlayer.immediate();
  const delta = now - tapePreviousPosition;
  tapePlayheadPosition = tapePlayheadPosition + delta * playbackRate.value;
  tapePreviousPosition = now;

  if (scenePlot.value !== undefined && sceneData.value !== undefined) {
    const scenePlayheadLine = {
      line: { color: colors.orange.darken2, width: 2 },
      type: "line",
      x0: tapePlayheadPosition,
      x1: tapePlayheadPosition,
      xref: "x",
      y0: sceneRange[0],
      y1: sceneRange[1],
      yref: "y",
    };
    Plotly.relayout(scenePlot.value, { shapes: [scenePlayheadLine] });
  }

  if (selectPlot.value !== undefined) {
    const playheadLine = {
      line: { color: colors.orange.darken2, width: 2 },
      type: "line",
      x0: tapePlayheadPosition,
      x1: tapePlayheadPosition,
      xref: "x",
      y0: navRange[0],
      y1: navRange[1],
      yref: "y",
    };
    tapePlayheadLineShape = playheadLine;

    const newShapes = [playheadLine];
    if (tapeSelectedRegionShape !== undefined) {
      newShapes.push(tapeSelectedRegionShape);
    }
    Plotly.relayout(selectPlot.value, { shapes: newShapes });
  }
};

// function playBoth() {
//   let offset = 0;
//   if (tapePlayheadSelect.value?.start !== undefined && tapePlayheadSelect.value?.end !== undefined) {
//     if (tapePlayheadPosition < tapePlayheadSelect.value.start || tapePlayheadPosition > tapePlayheadSelect.value.end) {
//       offset = tapePlayheadSelect.value.start
//     }
//   }
//   let duration;
//   if (tapePlayheadSelect.value?.end !== undefined) {
//     if (tapePlayheadSelect.value.end > tapePlayheadPosition) {
//       duration = tapePlayheadSelect.value.end - tapePlayheadPosition
//     }
//   }

//   // emit('update:controlPlay', {
//   //   action: "play",
//   //   offset: offset,
//   //   duration: duration,
//   // });

//   tapePlay();
// }

// function pausePlaying() {
//   emit('update:controlPlay', {
//     action: "pause",
//   });
//   if (recMediaPlayer !== null) {
//     recMediaPlayer.stop();
//   }
// }

// function restartRec() {
//   if (recMediaPlayer !== null) {
//     recMediaPlayer.stop();
//   }
//   playheadPosition.value = 0;
//   playRecording();
// }

// function restartSource() {
//   if (recMediaPlayer !== null) {
//     recMediaPlayer.stop();
//   }
//   playheadPosition.value = 0;
//   playRecording();
// }

// function restartBoth() {
//   if (tapeMediaPlayer !== null) {
//     tapeMediaPlayer.stop();
//   }
//   tapePlayheadPosition = 0;

//   let offset = 0;
//   if (tapePlayheadSelect.value?.start !== undefined) {
//     offset = tapePlayheadSelect.value.start
//   }
//   let duration;
//   if (tapePlayheadSelect.value?.end !== undefined) {
//     if (tapePlayheadSelect.value.end > tapePlayheadPosition) {
//       duration = tapePlayheadSelect.value.end - tapePlayheadPosition
//     }
//   }

//   // emit('update:controlPlay', {
//   //   action: "restart",
//   //   offset: offset,
//   //   duration: duration,
//   // });

//   restartRec();
// }

// process
const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_AWS_ACCESS_SECRET_KEY,
  },
  tls: false,
});


async function tapeExtractAudioChart(loadedBlob) {
  const { blob, duration, timestamp } = loadedBlob;
  const bucket = import.meta.env.VITE_BUCKET_NAME;
  const key = `uploads/${timestamp}.ogg`;

  console.debug('processing playback audio: ', timestamp, bucket, key, blob, duration);

  let objectExist = false;
  try {
    const output = await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    console.debug('! head output: ', output);
    objectExist = true;
  } catch (err) {
    console.debug('!! err: ', err);
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

  const mediaId = `uploads/${timestamp}`;

  const chart = await audioProcess({
    mediaId: mediaId,
  });

  console.debug('playback audio chart updated: ', chart);
  tapeAudioChart.value = chart;
}

// scene
watch([tapeAudioChart, sourceAudioChart, sourceTrack], ([tuneChart, sourceChart, track]) => {
  console.debug('! audio charts changed: ', tuneChart, sourceChart, track);

  const allTraces = [];

  if (tuneChart !== undefined) {
    const words = tuneChart.words;
    const phonemes = tuneChart.phonemes;

    const phonemeTraces = phonemes.map(p => ({
      x: [p.startTime, p.time, p.endTime],
      y: [p.startPitchLevel + 1, p.pitchLevel + 1, p.endPitchLevel + 1],
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
        y: [2, 2, 2],
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
    const duration = sourceChart.duration;

    const sourceCharOffset = sourceChart.offset ?? 0;
    const trackOffset = track[0] ?? 0;
    const offset = sourceCharOffset + trackOffset;

    const phonemeTraces = phonemes.map(p => {
      const startTime = p.startTime - offset;
      const time = p.time - offset;
      const endTime = p.endTime - offset;

      if (startTime < 0) {
        return null;
      }
      if (duration !== undefined && endTime > duration) {
        return null;
      }

      // console.debug('! phoneme: ', p, startTime, time, endTime, offset, duration);

      return {
        x: [startTime, time, endTime],
        y: [p.startPitchLevel, p.pitchLevel, p.endPitchLevel],
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

    // console.debug('! phonemeTraces: ', phonemeTraces);
    allTraces.push(...phonemeTraces);

    const wordsTraces = words.map(w => {
      const sourceCharOffset = sourceChart.offset ?? 0;
      const trackOffset = track[0] ?? 0;
      const offset = sourceCharOffset + trackOffset;

      const startTime = w.startTime - offset;
      const endTime = w.endTime - offset;

      if (startTime < 0) {
        return null;
      }
      if (duration !== undefined && endTime > duration) {
        return null;
      }

      // console.debug('! word: ', w, startTime, endTime, sourceCharOffset, duration);

      const time = (startTime + endTime) / 2;

      return {
        x: [startTime, time, endTime],
        y: [0, 0, 0],
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

    // console.debug('! wordsTraces: ', wordsTraces);
    allTraces.push(...wordsTraces);
  }

  console.debug('! allTraces: ', allTraces, allTraces.length);

  sceneData.value = {
    traces: allTraces,
    duration: tapeLoadedAudioBlob.value?.duration,
  }
})

// recording
watchEffect(() => {
  if (!recordingInProgress.value) {
    recordingIndicator.value = false;
  }
})

async function startRecording() {
  tapeStop();
  sourceStop();

  recordingIndicator.value = true;

  const recordingContext = new (window.AudioContext || window.webkitAudioContext)();

  const constraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      googHighpassFilter: false
    }
  }

  let stream = undefined;
  await navigator.mediaDevices.getUserMedia(constraints).then((s) => {
    stream = s
  }).catch(() => {
    console.error('failed to get user media: ', err.name, err.message);
    return
  });

  audioAnalyser = recordingContext.createAnalyser();
  // audioAnalyser.fftSize = 2048;
  // console.debug('! analyser params: ', audioAnalyser.fftSize, audioAnalyser.frequencyBinCount);
  bufferLength = audioAnalyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  // audioAnalyser.getByteTimeDomainData(dataArray);

  cvs = canvasElem.value.getContext("2d");
  width = canvasElem.value.clientWidth;
  height = canvasElem.value.clientHeight;
  // canvas.value.setAttribute("width", 200);

  let options = null;
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    console.debug('using supported codec: audio/webm');
    options = { mimeType: 'audio/webm' };
  } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus"')) {
    console.debug('audio/webm;cousing supported codec: decs=opus"');
    options = { mimeType: 'audio/webm;codecs=opus' };
  } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
    console.debug('using supported codec: audio/mp4');
    options = { mimeType: 'audio/mp4' };
  } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=aac')) {
    console.debug('using supported codec: audio/mp4;codecs=aac');
    options = { mimeType: 'audio/mp4;codecs=aac' };
  } else {
    console.error('no supported codec found');
    return;
  }

  const recordingSource = recordingContext.createMediaStreamSource(stream)
  const recorderDestNode = new MediaStreamAudioDestinationNode(recordingContext);

  mediaRecorder = new MediaRecorder(recorderDestNode.stream, options)

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    chunks.push(e.data);
  }

  mediaRecorder.onstop = (e) => {
    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);

    tapeAudioBlob.value = { blob: blob, url: blobUrl };
  }

  const gainNode = recordingContext.createGain();
  gainNode.value = 1;

  // recordingSource.connect(gainNode);

  recordingSource.connect(audioAnalyser)
  audioAnalyser.connect(recorderDestNode);
  audioAnalyser.connect(gainNode);
  gainNode.connect(recorderDestNode);

  drawRecordingAnimation();
  mediaRecorder.start();

  recordingInProgress.value = true;
  console.info('recording started');
}

function stopRecording() {
  window.cancelAnimationFrame(recordingAnimationCancel);

  if (mediaRecorder) {
    mediaRecorder.stop()
    mediaRecorder = null
  }

  recordingInProgress.value = false;
  console.info('recording stopped');
}

function drawRecordingAnimation() {
  recordingAnimationCancel = requestAnimationFrame(drawRecordingAnimation);

  audioAnalyser.getByteTimeDomainData(dataArray);

  cvs.fillStyle = "rgb(18, 18, 18)";
  cvs.fillRect(0, 0, width, height);

  cvs.lineWidth = 2;
  cvs.strokeStyle = "rgb(189, 189, 189)";

  cvs.beginPath();

  const sliceWidth = (width * 1.0) / bufferLength;
  let x = 0;

  // console.debug('!! drawRecordingAnimation: ', bufferLength, sliceWidth, width, height);

  for (let i = 0; i < bufferLength; i++) {
    let v = dataArray[i] / 128.0;
    let y = (v * height) / 2;

    if (i === 0) {
      cvs.moveTo(x, y);
    } else {
      cvs.lineTo(x, y);
    }

    x += sliceWidth;
  }

  cvs.lineTo(cvs.width, cvs.height / 2);
  cvs.stroke();
};

// source
watch(sourceDragTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const selectedRect = {
    line: {
      width: 1,
    },
    type: "rect",
    xref: "x",
    x0: x0,
    y0: navRange[0],
    yref: "y",
    x1: x1,
    y1: navRange[1],
    fillcolor: "rgb(225, 236, 225)",
    opacity: 0.5,
  };
  sourceSelectedRegionShape = selectedRect;

  const newShapes = [selectedRect];
  if (sourcePlayheadLineShape !== undefined) {
    newShapes.push(sourcePlayheadLineShape);
  }
  Plotly.relayout(sourceZoomPlot.value, { shapes: newShapes });
});

watch(sourceSelectTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const newShapes = [];
  if (sourcePlayheadLineShape !== undefined) {
    newShapes.push(sourcePlayheadLineShape);
  }
  Plotly.relayout(sourceZoomPlot.value, { shapes: newShapes });
});

watch(sourceAudioBlob, blob => {
  if (sourceMediaPlayer !== null) {
    sourceMediaPlayer.stop();
    sourceMediaPlayer.dispose();
  }

  sourceMediaPlayer = new Tone.Player(blob.url, onload = () => {
    sourceMediaPlayer.volume.value = calculateSourceMediaVolue(sourceVolumeLevel.value, balanceLevel.value);
    const timestamp = Date.now();
    const loadedBlob = { ...blob, duration: sourceMediaPlayer.buffer.duration };
    sourceLoadedAudioBlob.value = loadedBlob;
    sourceExtractAudioChart(loadedBlob);
  })
});

async function sourceExtractAudioChart(loadedBlob) {
  // let offset = dragTrack?.value?.x0 ?? 0;
  // let duration;
  // if (dragTrack?.value?.x0 !== undefined && dragTrack?.value?.x1 !== undefined) {
  //   duration = dragTrack.value.x1 - dragTrack.value.x0;
  // }

  // const offset = loadedBlob.selectRange[0];
  // const duration = loadedBlob.selectRange[1] - loadedBlob.selectRange[0];
  // console.debug('processing source audio: ', loadedBlob, offset, duration);

  console.debug('processing source audio: ', loadedBlob, loadedBlob.duration);

  const chart = await audioProcess({
    mediaId: loadedBlob.mediaId,
  });

  console.debug('source audio chart updated', chart);
  sourceAudioChart.value = { ...chart, duration: loadedBlob.duration };
}

watch(sourceLoadedAudioBlob, loadedBlob => {
  console.info('source audio loaded: ', loadedBlob);

  sourceMediaPlayer.connect(shiftPitch);
  shiftPitch.toDestination();

  sourceMediaPlayer.volume.value = newVolume;
  sourceMediaPlayer.playbackRate = newPlaybackRate;

  sourceMediaPlayer.onstop = () => {
    window.cancelAnimationFrame(sourceDrawPositionCancel);

    if (sourcePlayheadPosition - sourcePlayOffset > 0.1) {
      sourceClearPlayhead();
      sourceMediaPlaying.value = false;
    }
  }

  sourcePlayerLoaded.value = true;
})

watch(sourceLoadedAudioBlob, blob => {
  sourceRenderWaveform(blob.blob, blob.duration)
})

async function sourceRenderWaveform(blob, duration) {

  const reader = new FileReader();
  reader.addEventListener("loadend", () => {
    const arrayBuffer = reader.result

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const options = {
      audio_context: audioContext,
      array_buffer: arrayBuffer,
      scale: 4800
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
        samplesX.push(x / 10)
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

      sourceZoomData.value = {
        traces: traces,
        duration: duration,
      }
      sourceNavData.value = {
        traces: traces,
        duration: duration,
      }
    })
  });

  reader.readAsArrayBuffer(blob);
}

// watchEffect(() => {
//   if (sourceDragTrack.value?.x0 !== undefined && sourceDragTrack.value?.x1 !== undefined) {
//     sourcePlayheadSelect.value = {
//       start: sourceDragTrack.value.x0,
//       end: sourceDragTrack.value.x1,
//     }
//   }
// });

// watch(sourceDragTrack, ({ x0, x1 }) => {
//   if (x0 === undefined || x1 === undefined) return
//   sourcePlayheadSelect.value = {
//     start: x0,
//     end: x1,
//   }
// });

// watchEffect(() => {
//   sourcePlayheadSelect.value = {
//     start: 0,
//     end: sourceLoadedAudioBlob.value?.duration ?? 0,
//   }
// });

function sourceStop() {
  window.cancelAnimationFrame(sourceDrawPositionCancel);
  sourceClear();
  sourceMediaPlaying.value = false;
}

function sourceClear() {
  if (sourceMediaPlayer !== null) {
    sourceMediaPlayer.stop();
  }
  sourceClearPlayhead();
}

function sourceClearPlayhead() {
  if (scenePlot.value !== undefined) {
    Plotly.relayout(scenePlot.value, { shapes: [] });
  }
  if (sourceZoomPlot.value !== undefined) {
    const newShapes = [];
    if (sourceSelectedRegionShape !== undefined) {
      newShapes.push(sourceSelectedRegionShape);
    }
    Plotly.relayout(sourceZoomPlot.value, { shapes: newShapes });
  }
  if (sourceNavPlot.value !== undefined) {
    Plotly.relayout(sourceNavPlot.value, { shapes: [] });
  }
}

function sourcePlay() {
  tapeClear();
  sourceClear();

  sourcePlayOffset = sourceTrack.value[0];
  const duration = sourceTrack.value[1] - sourcePlayOffset;
  sourcePreviousPosition = sourceMediaPlayer.immediate();
  sourcePlayheadPosition = sourcePlayOffset;

  console.debug('! playing source: ', sourceTrack.value, sourcePlayOffset, duration, sourcePreviousPosition, playbackRate.value)
  sourceMediaPlayer.start(0, sourcePlayOffset, duration);

  sourceDrawPosition();

  sourceMediaPlaying.value = true;
}

function sourceDrawPosition() {
  sourceDrawPositionCancel = requestAnimationFrame(sourceDrawPosition);

  const now = sourceMediaPlayer.immediate();
  const delta = now - sourcePreviousPosition;
  sourcePlayheadPosition = sourcePlayheadPosition + delta * playbackRate.value;
  sourcePreviousPosition = now;

  if (scenePlot.value !== undefined && sceneData.value !== undefined) {
    const scenePlayheadLine = {
      line: { color: colors.red.darken2, width: 2 },
      type: "line",
      x0: sourcePlayheadPosition - sourcePlayOffset,
      x1: sourcePlayheadPosition - sourcePlayOffset,
      xref: "x",
      y0: sceneRange[0],
      y1: sceneRange[1],
      yref: "y",
    };
    Plotly.relayout(scenePlot.value, { shapes: [scenePlayheadLine] });
  }

  const playheadLine = {
    line: { color: colors.red.darken2, width: 2 },
    type: "line",
    x0: sourcePlayheadPosition,
    x1: sourcePlayheadPosition,
    xref: "x",
    y0: navRange[0],
    y1: navRange[1],
    yref: "y",
  };
  sourcePlayheadLineShape = playheadLine;

  if (sourceZoomPlot.value !== undefined) {
    const newShapes = [playheadLine];
    if (sourceSelectedRegionShape !== undefined) {
      newShapes.push(sourceSelectedRegionShape);
    }
    Plotly.relayout(sourceZoomPlot.value, { shapes: newShapes });
  }

  if (sourceNavPlot.value !== undefined) {
    Plotly.relayout(sourceNavPlot.value, { shapes: [playheadLine] });
  }
}

function bothPlay() {
  tapeClear();
  sourceClear();

  tapePlayOffset = tapeTrack.value[0];
  const tapeDuration = tapeTrack.value[1] - tapePlayOffset;
  tapePreviousPosition = tapeMediaPlayer.immediate();
  tapePlayheadPosition = tapePlayOffset;

  sourcePlayOffset = sourceTrack.value[0];
  const sourceDuration = sourceTrack.value[1] - sourcePlayOffset;
  sourcePreviousPosition = sourceMediaPlayer.immediate();
  sourcePlayheadPosition = sourcePlayOffset;

  tapeMediaPlayer.start(0, tapePlayOffset, tapeDuration);;
  sourceMediaPlayer.start(0, sourcePlayOffset, sourceDuration);

  tapeDrawPosition();
  sourceDrawPosition();

  tapeMediaPlaying.value = true;
  sourceMediaPlaying.value = true;
}

function bothStop() {
  tapeStop();
  sourceStop();
}

</script>

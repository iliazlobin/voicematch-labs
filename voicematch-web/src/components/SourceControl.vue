<template>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="zoomPlot" id="zoomPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="12">
        <v-sheet class="pa-2 ma-0" align="center">
          <div ref="navPlot" id="navPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0" justify="space-between" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-slider v-model="volumeLevel" class="pt-8 pl-8" min="0" max="100" step="1" thumb-label="always" thumb-size="14"
          hide-details @dblclick="e => resetVolumeLevel()"></v-slider>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <!-- <v-btn class="pa-2 ma-2" icon color="cyan-darken-3" rounded="lg" @click.prevent="e => restart()"
          :disabled="!canPlay">
          <v-icon icon="mdi-step-forward" size="x-large"></v-icon>
        </v-btn> -->
        <v-btn class="pa-2 ma-2" icon color="cyan-darken-3" rounded="lg" @click.prevent="e => canPause ? pause() : play()"
          :disabled="!canPlay">
          <v-icon :icon="canPause ? 'mdi-pause' : 'mdi-play'" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="cyan-darken-3" rounded="lg" @click.prevent="e => stop()"
          :disabled="!canStop">
          <v-icon icon="mdi-stop" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="cyan-darken-3" rounded="lg" @click.prevent="e => process()"
          :disabled="!canPlay">
          <v-icon icon="mdi-tray-arrow-down" size="x-large"></v-icon>
        </v-btn>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="4">
        <v-slider v-model="playbackRate" class="pt-8 pr-8" min="0.1" max="1.5" step="0.1" thumb-label="always"
          thumb-size="14" hide-details @dblclick="e => resetPlaybackRate()"></v-slider>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { usePlot } from '@/modules/plot.js';
import { audioProcess } from '@/services/downloads';
import Plotly from 'plotly.js-dist';
import * as Tone from 'tone';
import { computed, ref, watch, watchEffect } from 'vue';
import colors from 'vuetify/lib/util/colors';
import WaveformData from 'waveform-data';

const props = defineProps(['audioBlob', 'controlPlay', 'controlPlaybackRate', 'conrtolBalanceLevel'])
const emit = defineEmits(['update:audioChart'])

const playheadSelect = ref({ start: 0, end: 0 });
const playheadPosition = ref(0);

const audioChart = ref();
watch(audioChart, (c) => {
  emit('update:audioChart', c);
});

const zoomPlot = ref();
const zoomData = ref();
const navPlot = ref();
const navData = ref();
const selectTrack = ref();
const dragTrack = ref();
const navYaxisRange = [-100, 100];
usePlot({ plot: zoomPlot, data: zoomData, navigateEvent: selectTrack, resetEvent: selectTrack, navigateControl: dragTrack });
usePlot({ plot: navPlot, data: navData, navigateEvent: dragTrack, resetEvent: dragTrack, scrollControl: selectTrack, useDefaultDuration: true, dragmode: 'pan' });

const audioBlob = computed(() => props.audioBlob);
const controlPlay = computed(() => props.controlPlay);
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
let previousPosition = 0;

const controlBalanceLevel = computed(() => props.conrtolBalanceLevel);
const controlPlaybackRate = computed(() => props.controlPlaybackRate);

function resetVolumeLevel() {
  volumeLevel.value = defaultVolumeLevel;
}
function resetPlaybackRate() {
  playbackRate.value = defaultPlaybackRate;
}

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
  return !mediaEnded.value
})

watchEffect(() => {
  if (dragTrack.value?.x0 !== undefined && dragTrack.value?.x1 !== undefined) {
    playheadSelect.value = {
      start: dragTrack.value.x0,
      end: dragTrack.value.x1,
    }
  }
});

watch(dragTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return
  playheadSelect.value = {
    start: x0,
    end: x1,
  }
});

watchEffect(() => {
  playheadSelect.value = {
    start: 0,
    end: loadedAudioBlob.value?.duration ?? 0,
  }
});

const finalPlaybackRate = ref();
watchEffect(() => {
  finalPlaybackRate.value = playbackRate.value;
});
watchEffect(() => {
  if (controlPlaybackRate.value === undefined) return;
  finalPlaybackRate.value = controlPlaybackRate.value;
});

const defaultBalanceLevel = -1;
const balanceLevel = ref(defaultBalanceLevel);

watch(mediaPlaying, () => {
  balanceLevel.value = defaultBalanceLevel;
  finalPlaybackRate.value = defaultPlaybackRate;
});
watch(controlPlay, () => {
  balanceLevel.value = controlBalanceLevel.value;
  finalPlaybackRate.value = controlPlaybackRate.value;
});
watch(controlBalanceLevel, (level) => {
  balanceLevel.value = level;
  finalPlaybackRate.value = controlPlaybackRate.value;
});

watch([volumeLevel, balanceLevel], ([volume, balance]) => {
  const balanceCoef = balance > 0 ? 1 - balance : 1;
  const volumeValue = volume * balanceCoef;

  if (volumeValue > 0) {
    newVolume = Math.log(volumeValue / 100) / Math.log(1.06);
  } else {
    newVolume = -999;
  }

  // console.debug('! source volumeLevel: ', volume, balance, balanceCoef, volumeValue, newVolume);

  if (mediaPlayer !== null) {
    mediaPlayer.volume.value = newVolume;
  }
}, { immediate: true });

watch(finalPlaybackRate, (rate) => {
  newPlaybackRate = rate;
  shiftPitch.pitch = 12 * Math.log2(1 / rate);

  if (mediaPlayer !== null) {
    mediaPlayer.playbackRate = newPlaybackRate;
  }
}, { immediate: true });

watch(controlPlay, (c) => {
  console.debug('! controlPlay: ', c, c?.action)

  if (c?.action === undefined) {
    return
  }

  switch (c.action) {
    case 'play':
      offsetPlay({ offset: c?.offset, duration: c?.duration });
      break;
    case 'restart':
      offsetRestart({ offset: c?.offset, duration: c?.duration });
      break;
    case 'pause':
      pause();
      break;
    case 'stop':
      stop();
      break;
  }
})

watch(audioBlob, blob => {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
    mediaPlayer.dispose();
  }

  mediaPlayer = new Tone.Player(blob.url, onload = () => {
    loadedAudioBlob.value = { ...blob, duration: mediaPlayer.buffer.duration };
  })
});

watch(loadedAudioBlob, blob => {
  console.info('source audio loaded: ', blob);

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
    }
  }

  playerInitialized.value = true;
})

function play() {
  if (canPlay.value !== true) {
    return
  }

  let ofstPlay = 0;
  if (playheadSelect.value?.start !== undefined && playheadSelect.value?.end !== undefined) {
    if (playheadPosition.value < playheadSelect.value.start || playheadPosition.value > playheadSelect.value.end) {
      ofstPlay = playheadSelect.value.start;
    }
  }
  playheadPosition.value = ofstPlay;

  let playDuration;
  if (playheadSelect.value?.end !== undefined) {
    playDuration = playheadSelect.value.end - playheadPosition.value;
  }

  console.debug('! start playing: ', ofstPlay, playDuration, playheadSelect.value?.start, playheadSelect.value?.end, playheadPosition.value, playbackRate.value)

  previousPosition = mediaPlayer.immediate();
  mediaPlayer.start(0, ofstPlay, playDuration);

  drawPosition();

  mediaEnded.value = false;
  mediaPlaying.value = true;
}

function offsetPlay({ offset, duration }) {
  if (canPlay.value !== true) {
    return
  }

  console.debug('! offsetPlay: ', offset, duration, playheadSelect.value?.start)

  let offsetPlay = 0;
  if (playheadSelect.value?.start !== undefined) {
    offsetPlay = playheadSelect.value.start;
  }
  if (offset !== undefined) {
    offsetPlay = offsetPlay + offset;
  }
  playheadPosition.value = offsetPlay;

  let playDuration;
  if (playheadSelect.value?.end !== undefined) {
    playDuration = playheadSelect.value.end - playheadPosition.value;
  }
  if (duration !== undefined && duration < playDuration) {
    playDuration = duration;
  }

  console.debug('! start playing offset: ', offsetPlay, playDuration, playheadSelect.value?.start, playheadSelect.value?.end, playheadPosition.value, playbackRate.value)

  previousPosition = mediaPlayer.immediate();
  mediaPlayer.start(0, offsetPlay, playDuration);

  drawPosition();

  mediaEnded.value = false;
  mediaPlaying.value = true;
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
  Plotly.relayout(zoomPlot.value, { shapes: newShapes });
});

watch(selectTrack, ({ x0, x1 }) => {
  if (x0 === undefined || x1 === undefined) return

  const newShapes = [];
  if (playheadLineShape !== undefined) {
    newShapes.push(playheadLineShape);
  }
  Plotly.relayout(zoomPlot.value, { shapes: newShapes });
});

function drawPosition() {
  playingDrawCancel = requestAnimationFrame(drawPosition);

  const now = mediaPlayer.immediate();
  const delta = now - previousPosition;
  const newPosition = playheadPosition.value + delta * playbackRate.value;
  previousPosition = now;

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

  if (zoomPlot.value !== undefined) {
    const newShapes = [playheadLine];
    if (selectedRegionShape !== undefined) {
      newShapes.push(selectedRegionShape);
    }
    Plotly.relayout(zoomPlot.value, { shapes: newShapes });
  }

  if (navPlot.value !== undefined) {
    Plotly.relayout(navPlot.value, { shapes: [playheadLine] });
  }

  playheadPosition.value = newPosition;
};

function stop() {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
  window.cancelAnimationFrame(playingDrawCancel);
  playheadPosition.value = 0;

  mediaPlaying.value = false;
  mediaEnded.value = true;

  if (zoomPlot.value !== undefined) {
    const newShapes = [];
    if (selectedRegionShape !== undefined) {
      newShapes.push(selectedRegionShape);
    }
    Plotly.relayout(zoomPlot.value, { shapes: newShapes });
  }
  if (navPlot.value !== undefined) {
    Plotly.relayout(navPlot.value, { shapes: [] });
  }
}

function pause() {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
}

function restart() {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
  playheadPosition.value = 0;
  play();
}

function offsetRestart({ offset, duration }) {
  if (mediaPlayer !== null) {
    mediaPlayer.stop();
  }
  console.debug('! offsetRestart: ', offset, duration);
  playheadPosition.value = 0;
  offsetPlay({offset, duration});
}

async function process() {
  let offset = dragTrack?.value?.x0 ?? 0;
  let duration;
  if (dragTrack?.value?.x0 !== undefined && dragTrack?.value?.x1 !== undefined) {
    duration = dragTrack.value.x1 - dragTrack.value.x0;
  }

  console.debug('processing source audio: ', dragTrack?.value?.x0, dragTrack?.value?.x1, duration);
  const chart = await audioProcess({
    mediaId: loadedAudioBlob?.value?.youtube?.videoHash,
    offset: offset,
    duration: duration,
  });

  console.debug('source audio chart updated', chart, offset, duration);
  audioChart.value = { ...chart, offset: offset, duration: duration };

  // const words = audioChart.words;
  // const phonemes = audioChart.phonemes;

  // const allTraces = [];

  // const phonemeTraces = phonemes.map(p => ({
  //   x: [p.startTime, p.time, p.endTime],
  //   y: [p.startPitchLevel, p.pitchLevel, p.endPitchLevel],
  //   mode: 'lines+text',
  //   // type: 'scatter',
  //   text: ["", p.phoneme, ""],
  //   textposition: 'top center',
  //   line: {
  //     color: 'rgba(80, 207, 255, 0.7)',
  //     width: 3,
  //   },
  //   textfont: {
  //     family: 'Roboto',
  //     size: 18,
  //     color: "indianred",
  //   },
  // }))
  // // console.debug('phonemeTraces: ', phonemeTraces);
  // allTraces.push(...phonemeTraces);

  // const wordsTraces = [];
  // words.forEach((word, index) => {
  //   const trace = {
  //     x: [word.startTime, (word.startTime + word.endTime) / 2, word.endTime],
  //     y: [0, 0, 0],
  //     mode: 'lines+text',
  //     // type: 'scatter',
  //     text: ["", word.word, ""],
  //     textposition: 'top center',
  //     line: {
  //       color: 'rgb(55, 128, 191)',
  //       width: 3,
  //     },
  //     textfont: {
  //       family: 'Roboto',
  //       size: 14,
  //     },
  //   };
  //   wordsTraces.push(trace);
  // });

  // allTraces.push(...wordsTraces);

  // console.debug('! allTraces: ', allTraces);

  // sceneData.value = {
  //   traces: allTraces,
  //   duration: duration,
  // }
}

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
      scale: 4800
    }

    const wfd = WaveformData.createFromAudio(options, (err, waveform) => {
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

      zoomData.value = {
        traces: traces,
        duration: duration,
      }
      navData.value = {
        traces: traces,
        duration: duration,
      }
    })
  });

  reader.readAsArrayBuffer(blob);
}

</script>

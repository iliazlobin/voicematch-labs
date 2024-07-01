<template>
  <v-container class="d-flex justify-space-around align-center flex-row flex-md-row ma-1 pa-1">
    <v-row no-gutters justify="space-around">
      <v-col cols="4" class="pa-2 ma-2">
        <!-- <v-sheet class="pa-2 ma-2" align="center"> -->
          <v-btn block prepend-icon="mdi-record-circle-outline" rounded="lg" color="primary" :disabled="!canRecord"
            @click.prevent="mediaRecording ? stopRecording() : startRecording()">
            {{ mediaRecording ? 'Stop' : 'Record' }}
          </v-btn>
        <!-- </v-sheet> -->
      </v-col>
      <v-col cols="4" class="pa-2 ma-2">
        <!-- <v-sheet class="pa-2 ma-2" align="center"> -->
          <v-btn block prepend-icon="mdi-play-circle-outline" rounded="lg" color="primary" :disabled="!canPlayPause"
            @click.prevent="canPause ? pause() : play()">
            {{ canPause ? 'Pause' : 'Play' }}
          </v-btn>
        <!-- </v-sheet> -->
      </v-col>
      <v-col cols="4" class="pa-2 ma-2">
        <!-- <v-sheet class="pa-2 ma-2" align="center"> -->
          <v-btn block prepend-icon="mdi-stop-circle-outline" rounded="lg" color="primary" @click="stop()"
            :disabled="!canStop">
            Stop
          </v-btn>
        <!-- </v-sheet> -->
      </v-col>
    </v-row>
  </v-container>
  <!-- <v-sheet class="pa-2 ma-2" align="center">
    <canvas ref="canvasElem" class="visualizer" width="640" height="100"></canvas>
  </v-sheet> -->
  <v-sheet class="pa-2 ma-2" align="center">
    <v-slider v-model="playbackSpeed" max="2" step="0.1" min="0" thumb-label="always"></v-slider>
    <v-slider v-model="volumeLevel" max="100" step="1" min="0" thumb-label="always"></v-slider>
  </v-sheet>
</template>

<script setup>
import * as Tone from 'tone';
import { ref, computed, watch, watchEffect, onMounted } from 'vue';

const props = defineProps(['playbackPosition', 'navigatePosition'])
const emit = defineEmits(['update:playbackPosition', 'update:audioDuration', 'update:audioSource'])

// recording
// const recordingContext = ref();
// const recorderDest = ref();
// const recorderDestNode = null;
let mediaRecorder = null;
const mediaRecording = ref(false);

const canvasElem = ref(null)
let recordingDrawCancel = null;

// player
let mediaPlayer = null;
const playbackSpeed = ref(1);
const shiftPitch = new Tone.PitchShift(1);
const volumeLevel = ref(100);
let offsetPosition = 0;
let previousPosition = 0;
let playingDrawCancel = null;

const loadedBlob = ref(undefined); // blob
const playerInitialized = ref(false);
const mediaPlaying = ref(false);
const mediaEnded = ref(true);


const canRecord = computed(() => {
  return !mediaPlaying.value
})
const canPlayPause = computed(() => {
  return !mediaRecording.value && playerInitialized.value
})
const canPause = computed(() => {
  return !mediaRecording.value && mediaPlaying.value && !mediaEnded.value
})
const canStop = computed(() => {
  return !mediaRecording.value && !mediaEnded.value
})
// const recordingRunning = computed(() => {
//   // console.debug('! recordingRunning: ', recordingContext, recordingContext?.state)
//   return recordingContext ? recordingContext.state === 'suspended' : false
//   // return recordingContext ? recordingContext.state === 'running' : false
// })

watch(playbackSpeed, () => {
  if (mediaPlayer === null) {
    return
  }

  console.debug('! set playback speed: ', playbackSpeed.value)
  mediaPlayer.playbackRate = playbackSpeed.value
  shiftPitch.pitch = 12 * Math.log2(1 / playbackSpeed.value)
})

watch(volumeLevel, () => {
  if (mediaPlayer === null) {
    return
  }

  if (volumeLevel.value > 0) {
    mediaPlayer.volume.value = Math.log(volumeLevel.value / 100) / Math.log(1.06)
  } else {
    mediaPlayer.volume.value = -999
  }
  // console.debug('! volume is sset ', volumeLevel.value, mediaPlayer.volume.value)
})

async function startRecording() {
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
    console.error('getUserMedia error: ', err.name + ": " + err.message);
    return
  });
  const recordingSource = recordingContext.createMediaStreamSource(stream)

  // visualizer
  // const audioAnalyser = recordingContext.createAnalyser();

  // analyser.fftSize = 2048;
  // console.debug('analyser params: ', audioAnalyser.fftSize, audioAnalyser.frequencyBinCount);
  // const bufferLength = audioAnalyser.frequencyBinCount;
  // const dataArray = new Uint8Array(bufferLength);
  // analyser.getByteTimeDomainData(dataArray);

  // const cvs = canvasElem.value.getContext("2d");
  // const width = canvasElem.value.clientWidth;
  // const height = canvasElem.value.clientHeight;
  // canvas.value.setAttribute("width", intendedWidth);

  // const draw = function () {
  //   recordingDrawCancel = requestAnimationFrame(draw);

  //   audioAnalyser.getByteTimeDomainData(dataArray);

  //   cvs.fillStyle = "rgb(200, 200, 200)";
  //   cvs.fillRect(0, 0, width, height);

  //   cvs.lineWidth = 2;
  //   cvs.strokeStyle = "rgb(0, 0, 0)";

  //   cvs.beginPath();

  //   const sliceWidth = (width * 1.0) / bufferLength;
  //   let x = 0;

  //   for (let i = 0; i < bufferLength; i++) {
  //     let v = dataArray[i] / 128.0;
  //     let y = (v * height) / 2;

  //     if (i === 0) {
  //       cvs.moveTo(x, y);
  //     } else {
  //       cvs.lineTo(x, y);
  //     }

  //     x += sliceWidth;
  //   }

  //   cvs.lineTo(cvs.width, cvs.height / 2);
  //   cvs.stroke();
  // };

  // draw();

  const chunks = [];

  const recorderDestNode = new MediaStreamAudioDestinationNode(recordingContext);

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
  }

  mediaRecorder = new MediaRecorder(recorderDestNode.stream, options)

  mediaRecorder.ondataavailable = (e) => {
    chunks.push(e.data);
  }

  mediaRecorder.onstop = (e) => {
    console.debug('media recorder stopped event: ', e)

    const blob = new Blob(chunks);
    console.debug('! audio blob: ', blob)

    const url = URL.createObjectURL(blob);
    console.debug('! blob url: ', url)
    // downloadLinkRef.value = url;
    // downloadLinkName.value = "audio.webm";

    if (mediaPlayer !== null) {
      mediaPlayer.stop();
      mediaPlayer.dispose();
    }

    mediaPlayer = new Tone.Player(url, onload = () => {
      console.debug('! media loaded: ', mediaPlayer, ' initializing')
      loadedBlob.value = blob;
    })
  }

  const gainNode = recordingContext.createGain();
  gainNode.value = 0.5;

  recordingSource.connect(gainNode)
  // recordingSource.connect(audioAnalyser)
  // audioAnalyser.connect(recorderDestNode);
  // audioAnalyser.connect(gainNode);
  gainNode.connect(recorderDestNode)

  mediaRecorder.start();

  mediaRecording.value = true;

  console.info('recording started')
}

function stopRecording() {
  // if (recordingContext) {
  //   recordingContext.close()
  //   recordingContext = null
  // }

  // window.cancelAnimationFrame(recordingDrawCancel);

  if (mediaRecorder) {
    mediaRecorder.stop()
    mediaRecorder = null
  }

  mediaRecording.value = false;

  console.log('recording stopped')
}

watch(loadedBlob, (blob) => {
  console.debug('! media loaded: ', mediaPlayer.buffer.duration)

  mediaPlayer.connect(shiftPitch);
  shiftPitch.toDestination();

  mediaPlayer.onstop = () => {
    window.cancelAnimationFrame(playingDrawCancel);

    const now = mediaPlayer.immediate();
    const delta = now - previousPosition;
    const stoppedAt = offsetPosition + delta * playbackSpeed.value;

    console.debug('media player stopped at: ', stoppedAt, mediaPlayer.buffer.duration)

    mediaPlaying.value = false;

    if (mediaPlayer.buffer.duration - stoppedAt < 0.01) {
      offsetPosition = 0;
      emit('update:playbackPosition', offsetPosition);

      mediaEnded.value = true;
    }
  }

  playerInitialized.value = true;
  emit('update:audioSource', { "blob": blob, "duration": mediaPlayer.buffer.duration })
})

function drawPosition() {
  playingDrawCancel = requestAnimationFrame(drawPosition);

  const now = mediaPlayer.immediate();
  const delta = now - previousPosition;
  offsetPosition = offsetPosition + delta * playbackSpeed.value;
  // console.debug('! sample at: ', now, previousPosition, delta, offsetPosition);
  previousPosition = now;

  emit('update:playbackPosition', offsetPosition);
};

function play() {
  const x0 = props.navigatePosition?.x0
  const x1 = props.navigatePosition?.x1
  if (x0 !== undefined && x1 !== undefined && !(offsetPosition > x0 && offsetPosition < x1)) {
    console.debug('! offsetPosition: ', offsetPosition, x0, x1)
    offsetPosition = x0
  }

  let playDuration = undefined
  const stopAt = props.navigatePosition?.x1
  if (stopAt !== undefined) {
    playDuration = stopAt - offsetPosition
  }

  console.debug('starting at: ', offsetPosition, ' duration: ', playDuration, ' rate: ', playbackSpeed.value)
  previousPosition = mediaPlayer.immediate();
  mediaPlayer.start(0, offsetPosition, playDuration);

  drawPosition();

  mediaEnded.value = false;
  mediaPlaying.value = true;
}

function stop() {
  mediaPlayer.stop()
  window.cancelAnimationFrame(playingDrawCancel);
  offsetPosition = 0;
  emit('update:playbackPosition', offsetPosition);

  mediaPlaying.value = false;
  mediaEnded.value = true;
}

function pause() {
  mediaPlayer.stop()
}

</script>

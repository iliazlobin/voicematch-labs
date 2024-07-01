<template>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0" justify="space-between" align="center">
      <v-col class="pa-0 ma-0" align="center" cols="2">
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" :disabled="!canRecord"
          @click.prevent="e => mediaRecording ? stopRecording() : startRecording()">
          <v-icon :icon="mediaRecording ? 'mdi-stop' : 'mdi-record'" size="x-large"></v-icon>
        </v-btn>
        <v-btn class="pa-2 ma-2" icon color="teal-darken-3" rounded="lg" :disabled="true">
          <v-icon icon="mdi-tray-arrow-up" size="x-large"></v-icon>
          <!-- <v-icon icon="mdi-file-upload" size="x-large"></v-icon> -->
        </v-btn>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="2">
        <v-sheet color="transparent" class="pt-1" align="baseline">
          <canvas ref="canvasElem" class="visualizer" width="128" height="50"></canvas>
        </v-sheet>
      </v-col>
      <v-col class="pa-0 ma-0" align="center" cols="8">
        <v-sheet color="transparent" class="pa-2" align="baseline">
          <div ref="recPlot" id="zoomPlot"></div>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { usePlot } from '@/modules/plot.js';
import * as Tone from 'tone';
import { computed, ref, watch } from 'vue';
import WaveformData from 'waveform-data';
import colors from 'vuetify/lib/util/colors';

const props = defineProps()
const emit = defineEmits(['update:audioBlob'])

const recPlot = ref();
const recData = ref(null);
usePlot({ plot: recPlot, data: recData, height: 50, dragmode: false });

let mediaRecorder = null;
const mediaRecording = ref(false);

let mediaPlayer = null;

const audioBlob = ref(null);

const canRecord = computed(() => {
  return true;
});
const canProcess = computed(() => {
  return audioBlob.value !== null && !mediaRecording.value
});

const canvasElem = ref(null);
let recordingAnimationCancel = null;
let audioAnalyser;
let bufferLength;
let dataArray;
let cvs;
let width;
let height;

// async function process() {
//   emit('update:audioBlob', audioBlob.value);
// }

watch(audioBlob, (b) => {
  emit('update:audioBlob', audioBlob.value);
});

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

    if (mediaPlayer !== null) {
      mediaPlayer.stop();
      mediaPlayer.dispose();
    }
    mediaPlayer = new Tone.Player(blobUrl, onload = () => {
      console.debug('recording is ready: ', blobUrl, mediaPlayer.buffer.duration);
      audioBlob.value = { blob: blob, url: blobUrl, duration: mediaPlayer.buffer.duration };
    })
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

  mediaRecording.value = true;
  console.info('recording started')
}

function stopRecording() {
  // if (recordingContext) {
  //   recordingContext.close()
  //   recordingContext = null
  // }

  window.cancelAnimationFrame(recordingAnimationCancel);

  if (mediaRecorder) {
    mediaRecorder.stop()
    mediaRecorder = null
  }

  mediaRecording.value = false;
  console.info('recording stopped')
}

function drawRecordingAnimation() {
  recordingAnimationCancel = requestAnimationFrame(drawRecordingAnimation);

  audioAnalyser.getByteTimeDomainData(dataArray);

  cvs.fillStyle = "rgb(200, 200, 200)";
  cvs.fillRect(0, 0, width, height);

  cvs.lineWidth = 2;
  cvs.strokeStyle = "rgb(0, 0, 0)";

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

watch(audioBlob, (b) => {
  redrawPlot(b.blob, b.duration)
});

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

      const channel = waveform.channel(0);

      const samplesX = []
      for (let x = 0; x < waveform.length; x++) {
        samplesX.push(x / 100)
      }

      const maxSamplesY = []
      for (let x = 0; x < waveform.length; x++) {
        const val = channel.max_sample(x) * 0.5;
        maxSamplesY.push(val)
      }

      const minSamplesY = []
      for (let x = 0; x < waveform.length; x++) {
        const val = channel.min_sample(x) * 0.5;
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

      recData.value = {
        traces: traces,
        duration: duration,
      }
    })
  });

  reader.readAsArrayBuffer(blob);
}

</script>

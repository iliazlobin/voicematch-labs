<template>
  <v-sheet class="pa-2 ma-0" align="center">
    <div ref="sceneElem" id="scene-plot"></div>
  </v-sheet>
</template>

<script setup>
import { evaluatePitch, recognizePhonemes, recognizeWords } from '@/services/predictions.ts';
import { linear } from 'everpolate';
import { zip } from 'lodash-es';
import Plotly from 'plotly.js-dist';
import { onMounted, ref, watch } from 'vue';
import colors from 'vuetify/lib/util/colors';

const props = defineProps(['playbackPosition', 'navigateScroll', 'audioSource'])
const emit = defineEmits(['update:playbackPosition', 'update:navigateScene'])

const sceneElem = ref(null)
const plotData = ref(null);

const defaultDuration = 3;
const defaultRangeY = [-0.05, 1];
const defaultLayout = {
  autosize: true,
  height: 500,
  showlegend: false,
  // xanchor: 'center',
  xaxis: {
    autorange: false,
    rangemode: 'tozero',
    showgrid: true,
    zeroline: false,
    showline: false,
    automargin: true,
    ticklabelposition: 'inside',
    tickfont: {
      family: 'Roboto',
      size: 10,
    },
    type: 'linear',
    // ticklabelstep: 10,
    // dtick: 0.1,
    nticks: 10,
    tickmode: 'auto',
    // ticklabelmode: 'period',
    // ticksuffix: 's',
  },
  yanchor: 'center',
  yaxis: {
    range: defaultRangeY,
    fixedrange: true,
    autorange: false,
    rangemode: 'tozero',
    showgrid: false,
    zeroline: true,
    showline: false,
    automargin: true,
    autoshift: true,
  },
  margin: {
    autoexpand: false,
    l: 0,
    r: 0,
    b: 0,
    t: 0,
    pad: 0,
  },
  clickmode: 'event',
  dragmode: 'pan',
  selectdirection: 'h',
  activeselection: {
    fillcolor: 'rgba(0,100,0,0.3)',
    opacity: 0.3,
  },
  // plot_bgcolor: "rgba(0,0,0,0)",
  // paper_bgcolor: "rgba(0,0,0,0)"
}
const config = {
  displayModeBar: false,
  doubleClick: false,
  // responsive: true,
}

watch(sceneElem, () => {
  Plotly.newPlot(sceneElem.value, null, defaultLayout, config);
  Plotly.relayout(sceneElem.value, defaultLayout)

  plotData.value = {
    traces: [{
      x: [],
      y: [],
    }],
    duration: defaultDuration,
  }

  sceneElem.value.on('plotly_relayout', function (event) {
    let x0 = event["xaxis.range[0]"]
    let x1 = event["xaxis.range[1]"]
    if (x0 !== undefined && x1 !== undefined) {
      const duration = props.audioSource?.duration;

      if (x0 < 0) {
        x0 = 0
        const newLayout = defaultLayout
        newLayout.xaxis.range = [x0, x1]
        Plotly.relayout(sceneElem.value, newLayout)
      }
      if (x1 > duration) {
        x1 = duration
        const newLayout = defaultLayout
        newLayout.xaxis.range = [x0, duration]
        Plotly.relayout(sceneElem.value, newLayout)
      }
      console.debug('navigate scene event: ', x0, x1)
      emit('update:navigateScene', { "x0": x0, "x1": x1 })
    }
  })
})

watch(plotData, (data) => {
  Plotly.react(sceneElem.value, data.traces);
  const newLayout = defaultLayout
  newLayout.xaxis.range = [0, data.duration]
  Plotly.relayout(sceneElem.value, newLayout);
  // Plotly.restyle(scrollElem.value, {selectedpoints: [null]});

  // console.info('redraw scene: ', sceneElem.value, allTraces)
  // Plotly.react(sceneElem.value, allTraces);
  // const newLayout = defaultLayout
  // newLayout.xaxis.range = [0, duration]
  // Plotly.relayout(sceneElem.value, newLayout)
});


watch(() => props.navigateScroll, (nav) => {
  const newLayout = defaultLayout
  newLayout.xaxis.range = [nav.x0, nav.x1]
  Plotly.relayout(sceneElem.value, newLayout)
})

watch(() => props.playbackPosition, (position) => {
  const newShape = {
    line: { color: colors.orange.darken2, width: 2 },
    type: "line",
    x0: position,
    x1: position,
    xref: "x",
    y0: defaultRangeY[0],
    y1: defaultRangeY[1],
    yref: "y",
  }
  Plotly.relayout(sceneElem.value, { shapes: [newShape] });
})

watch(() => props.audioSource, (source) => {
  redrawPlot(source.blob, source.duration)
})

async function redrawPlot(blob, duration) {
  const [words, phonemes, pitch] = await Promise.all([
    recognizeWords(blob),
    recognizePhonemes(blob),
    evaluatePitch(blob),
  ]);
  // const [someResult, anotherResult] = await Promise.all([someCall(), anotherCall()]);

  // const words = await recognizeWords(blob);
  // console.debug('words: ', words);
  // const phonemes = await recognizePhonemes(blob);
  // console.debug('phonemes: ', phonemes);
  // const pitch = await evaluatePitch(blob);
  // console.debug('pitch: ', pitch);

  const phonemeSounds = phonemes.map(p => p.char)

  const timestamps = phonemes.map(p => (p.start_time + p.end_time) / 2)
  const startTimestamps = phonemes.map(p => p.start_time)
  const endTimestamps = phonemes.map(p => p.end_time)

  const pitchList = pitch.map(p => p.pitch)
  const pitchTimestamps = pitch.map(p => p.time)

  const pitchLevels = linear(timestamps, pitchTimestamps, pitchList)
  // console.debug('pitchLevels: ', pitchLevels);
  const startPitchLevels = linear(startTimestamps, pitchTimestamps, pitchList)
  // console.debug('startPitchLevels: ', startPitchLevels);
  const stopPitchLevels = linear(timestamps, pitchTimestamps, pitchList)
  // console.debug('stopPitchLevels: ', stopPitchLevels);
  // const semitoneLevels = linear(timestamps, pitchTimestamps, pitchList)
  // const confidenceLevels = linear(timestamps, pitchTimestamps, pitchList)

  const zipped = zip(phonemes, timestamps, pitchLevels)
  // console.debug('zipped: ', zipped);

  const processedPhonemes = [];
  for (const i in phonemeSounds) {
    processedPhonemes.push({
      phoneme: phonemeSounds[i],
      timestamp: timestamps[i],
      startTimestamp: startTimestamps[i],
      endTimestamp: endTimestamps[i],
      pitchLevel: pitchLevels[i],
      startPitchLevel: startPitchLevels[i],
      stopPitchLevel: stopPitchLevels[i],
      // semitone: semitoneLevels[i],
      // confidence: confidenceLevels[i],
    })
  }
  // console.debug('processedPhonemes: ', processedPhonemes);

  // const processedPhonemes = zipWith(phonemeSounds, timestamps, pitchLevels, semitoneLevels, confidenceLevels, (s, ) => ({
  //   phoneme: s,
  //   timestamp: t,
  //   startTimestamp: p["start_time"],
  //   endTimestamp: p["end_time"],
  //   pitch: l,
  //   semitone: s,
  //   confidence: c,
  // }));
  // console.debug('processedPhonemes: ', processedPhonemes);

  const allTraces = [];

  const phonemeTraces = processedPhonemes.map(p => ({
    x: [p.startTimestamp, p.timestamp, p.endTimestamp],
    y: [p.startPitchLevel, p.pitchLevel, p.stopPitchLevel],
    mode: 'lines+text',
    // type: 'scatter',
    text: ["", p.phoneme, ""],
    textposition: 'top center',
    line: {
      color: 'rgba(80, 207, 255, 0.7)',
      width: 3,
    },
    textfont: {
      family: 'Roboto',
      size: 18,
      color: "indianred",
    },
  }))
  // console.debug('phonemeTraces: ', phonemeTraces);
  allTraces.push(...phonemeTraces);

  const wordsTraces = [];
  words.forEach((word, index) => {
    const trace = {
      x: [word.start_time, (word.start_time + word.end_time) / 2, word.end_time],
      y: [0, 0, 0],
      mode: 'lines+text',
      // type: 'scatter',
      text: ["", word.word, ""],
      textposition: 'top center',
      line: {
        color: 'rgb(55, 128, 191)',
        width: 3,
      },
      textfont: {
        family: 'Roboto',
        size: 14,
      },
    };
    wordsTraces.push(trace);
  });

  allTraces.push(...wordsTraces);

  plotData.value = {
    traces: allTraces,
    duration: duration,
  }
}

</script>

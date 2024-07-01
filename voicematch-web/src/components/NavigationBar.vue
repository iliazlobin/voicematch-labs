<template>
  <v-sheet class="pa-2 ma-0" align="center">
    <div ref="scrollPlot" id="scrollPlot"></div>
  </v-sheet>
</template>

<script setup>
import Plotly from 'plotly.js-dist';
import { ref, watch } from 'vue';
import colors from 'vuetify/lib/util/colors';
import WaveformData from 'waveform-data';

const props = defineProps(['playbackPosition', 'navigateScene', 'audioSource'])
const emit = defineEmits(['update:playbackPosition', 'update:navigateScroll'])

const scrollPlot = ref();
const plotData = ref(null);

const defaultDuration = 3;
const defaultRangeY = [-100, 100];
const defaultLayout = {
  autosize: true,
  height: 100,
  showlegend: false,
  // xanchor: 'center',
  xaxis: {
    range: [0, defaultDuration],
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
  // clickmode: 'event',
  // dragmode: 'zoom',
  dragmode: 'select',
  selectdirection: 'h',
  activeselection: {
    fillcolor: 'rgba(0,100,0,0.3)',
    opacity: 0.3,
  },
  // plot_bgcolor: "rgba(0,0,0,0)",
  // paper_bgcolor: "rgba(0,0,0,0)"
  selections: [],
};
const config = {
  displayModeBar: false,
  doubleClick: false,
  // responsive: true,
  // staticPlot: true,
};

watch(scrollPlot, () => {
  Plotly.newPlot(scrollPlot.value, null, defaultLayout, config);
  Plotly.relayout(scrollPlot.value, defaultLayout)

  plotData.value = {
    traces: [{
      x: [],
      y: [],
    }],
    duration: defaultDuration,
  }

  scrollPlot.value = document.getElementById("scrollPlot");

  scrollPlot.value.on('plotly_relayout', function (event) {
    const x0 = event["xaxis.range[0]"]
    const x1 = event["xaxis.range[1]"]
    if (x0 !== undefined && x1 !== undefined) {
      console.debug('navigate scroll event: ', x0, x1)
      emit('update:navigateScroll', { "x0": x0, "x1": x1 })
    }
  })
  scrollPlot.value.on('plotly_doubleclick', function (event) {
    const duration = props.audioSource?.duration ?? defaultDuration
    if (duration !== undefined) {
      const newLayout = defaultLayout
      newLayout.xaxis.range = [0, duration]
      Plotly.relayout(scrollPlot.value, newLayout)

      emit('update:navigateScroll', { "x0": 0, "x1": duration })
    } else {
      Plotly.relayout(scrollPlot.value, defaultLayout)
    }
  })
  scrollPlot.value.on('plotly_selected', function (event) {
    const x0 = event?.range?.x[0]
    const x1 = event?.range?.x[1]
    const selections = event?.selections

    // console.debug('! plotly_selected event: ', event, x0, x1, selections)

    if (x0 !== undefined && x1 !== undefined && selections.length > 0) {
      const lastSelection = selections[selections.length - 1]

      let newSelection = undefined
      if (lastSelection.y0 != defaultRangeY[0] || lastSelection.y1 != defaultRangeY[1] || selections.length > 1) {
        if (newSelection === undefined) {
          newSelection = lastSelection
        }
        newSelection.y0 = defaultRangeY[0]
        newSelection.y1 = defaultRangeY[1]
      }
      if (lastSelection.x0 < 0) {
        if (newSelection === undefined) {
          newSelection = lastSelection
        }
        newSelection.x0 = 0
      }
      const duration = props.audioSource?.duration
      if (duration !== undefined && lastSelection.x1 > duration) {
        if (newSelection === undefined) {
          newSelection = lastSelection
        }
        newSelection.x1 = duration
      }
      if (newSelection !== undefined) {
        Plotly.relayout(scrollPlot.value, { selections: [newSelection] });
      }

      if (newSelection === undefined) {
        newSelection = lastSelection
      }

      if (newSelection !== undefined && newSelection.x0 !== undefined && newSelection.x1 !== undefined) {
        // console.debug('! navigate select scroll event: ', newSelection.x0, newSelection.x1)
        emit('update:navigateScroll', { "x0": newSelection.x0, "x1": newSelection.x1 })
      }
    } else if (event === undefined || (x0 === undefined && x1 === undefined && selections !== undefined && selections.length === 0)) {
      let x1 = props.audioSource?.duration
      if (x1 === undefined) {
        x1 = defaultDuration
      }

      const newLayout = defaultLayout
      newLayout.xaxis.range = [0, x1]
      Plotly.relayout(scrollPlot.value, newLayout)

      Plotly.restyle(scrollPlot.value, { selectedpoints: [null] });

      // console.debug('! navigate reset scroll event: ', 0, x1)
      emit('update:navigateScroll', { "x0": 0, "x1": x1 })
    }
  })
});

watch(plotData, (data) => {
  Plotly.react(scrollPlot.value, data.traces);
  const newLayout = defaultLayout
  newLayout.xaxis.range = [0, data.duration]
  Plotly.relayout(scrollPlot.value, newLayout);
  // Plotly.restyle(scrollPlot.value, {selectedpoints: [null]});
});

watch(() => props.navigateScene, () => {
  const x0 = props.navigateScene?.x0
  const x1 = props.navigateScene?.x1
  if (x0 !== undefined && x1 !== undefined) {
    const newSelection = {
      line: { width: 1, dash: 'dot' },
      opacity: undefined,
      type: "rect",
      x0: x0,
      // x1: props.audioSource?.duration ?? x1,
      x1: x1,
      xref: "x",
      y0: defaultRangeY[0],
      y1: defaultRangeY[1],
      yref: "y",
    }
    console.debug(' navigate scene: ', x0, x1, newSelection)
    Plotly.relayout(scrollPlot.value, { selections: [newSelection] });
  }
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
  Plotly.relayout(scrollPlot.value, { shapes: [newShape] });
})

watch(() => props.audioSource, (source) => {
  redrawPlot(source.blob, source.duration)
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

    const wfd = WaveformData.createFromAudio(options, (err, waveform) => {
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

      plotData.value = {
        traces: traces,
        duration: duration,
      }
    })
  });

  reader.readAsArrayBuffer(blob);
}

</script>

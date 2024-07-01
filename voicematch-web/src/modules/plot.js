import Plotly from 'plotly.js-dist';
import { onMounted, watch } from 'vue';
import colors from 'vuetify/lib/util/colors';

// const defaultDuration = 6;
const defaultLayout = {
  autosize: true,
  height: 100,
  showlegend: false,
  // xanchor: 'center',
  xaxis: {
    // range: [0, defaultDuration],
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
    // range: [-100, 100],
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
  // selections: [],
};
const config = {
  displayModeBar: false,
  doubleClick: false,
  // responsive: true,
  // staticPlot: true,
};

export function usePlot({ plot, data, scrollControl, navigateControl, navigateEvent, resetEvents, dragmode = 'select', leftDragLock, rightDragLock, position, height = 100, defaultDuration = 3, useDefaultDuration = false, preventDataChangeNavigation = false, preventResetNavigation = false, yaxisRange = [-100, 100] }) {
  let savedSelection = null;
  let savedRange = null;
  let savedDragX0 = null;
  let savedDragX1 = null;

  const initLayout = { ...defaultLayout, dragmode: dragmode, height: height, xaxis: {...defaultLayout.xaxis, range: [0, defaultDuration]}, yaxis: { ...defaultLayout.yaxis, range: yaxisRange } };

  onMounted(() => {
    // data.value = {
    //   traces: [{
    //     x: [],
    //     y: [],
    //   }],
    //   duration: defaultDuration,
    // }

    Plotly.newPlot(plot.value, null, initLayout, config);
    Plotly.relayout(plot.value, initLayout)

    plot.value.on('plotly_relayout', function (event) {
      let x0 = event["xaxis.range[0]"]
      let x1 = event["xaxis.range[1]"]

      // // console.debug('! plotly_relayout: ', plot.value, event, x0, x1);

      if (x0 !== undefined && x1 !== undefined) {

        let changed = false;
        if (leftDragLock?.value) {
          if (x0 !== savedDragX0) {
            changed = true;
            x0 = savedDragX0;
          }
        }
        if (rightDragLock?.value) {
          if (x1 !== savedDragX1) {
            changed = true;
            x1 = savedDragX1;
          }
        }
        if (changed) {
          Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [x0, x1] } });
          savedRange = [x0, x1];
        }

        savedDragX0 = x0;
        savedDragX1 = x1;

        if (navigateEvent !== undefined) {
          // console.debug('! navigate scroll event: ', plot.value, x0, x1);
          navigateEvent.value = { "x0": x0, "x1": x1 };
        }
      }
    });
    if (dragmode === 'select') {
      plot.value.on('plotly_doubleclick', function (event) {
        const dur = data.value.duration ?? defaultDuration
        if (dur !== undefined) {
          const newLayout = initLayout
          let leftLimit = 0;
          // if (scrollControl?.value?.x0 !== undefined) {
          //   leftLimit = scrollControl.value.x0;
          // }
          let rightLimit = dur;
          // if (scrollControl?.value?.x1 !== undefined) {
          //   rightLimit = scrollControl.value.x1;
          // }
          newLayout.xaxis.range = [leftLimit, rightLimit]
          Plotly.relayout(plot.value, newLayout)
          savedRange = [leftLimit, rightLimit];
          if (navigateEvent !== undefined) {
            // console.debug('! navigate double click event: ', plot.value, leftLimit, rightLimit)
            navigateEvent.value = { "x0": leftLimit, "x1": rightLimit }
          }
        } else {
          Plotly.relayout(plot.value, initLayout)
          savedRange = [0, defaultDuration];
        }
        savedSelection = null;
      });
    }
    plot.value.on('plotly_selected', function (event) {
      let x0 = event?.range?.x[0];
      let x1 = event?.range?.x[1];
      if (x1 < x0) {
        const x = x0;
        x0 = x1;
        x1 = x;
      }

      // console.debug('! plotly_selected: ', plot.value, event, x0, x1);

      const selections = event?.selections.map(s => {
        if (s.x1 > s.x0) {
          return s;
        }
        const x = s.x0;
        return {
          ...s,
          x0: s.x1,
          x1: x,
        };
      })

      if (x0 !== undefined && x1 !== undefined && selections.length > 0) {
        const lastSelection = selections[selections.length - 1]

        let newSelection = lastSelection;
        let changed = false;
        if (lastSelection.y0 != yaxisRange[0] || lastSelection.y1 != yaxisRange[1] || selections.length > 1) {
          changed = true;
          newSelection.y0 = yaxisRange[0];
          newSelection.y1 = yaxisRange[1];
        }
        let leftLimit = 0;
        if (scrollControl?.value?.x0 !== undefined) {
          leftLimit = scrollControl.value.x0;
        }
        if (lastSelection.x0 < leftLimit) {
          changed = true;
          newSelection.x0 = leftLimit;
        }
        let rightLimit = data.value.duration ?? defaultDuration
        if (scrollControl?.value?.x1 !== undefined) {
          rightLimit = scrollControl.value.x1;
        }
        if (lastSelection.x1 > rightLimit) {
          changed = true;
          newSelection.x1 = rightLimit;
        }
        if (changed) {
          // console.debug('! newSelection: ', newSelection, lastSelection);
          Plotly.relayout(plot.value, { selections: [newSelection] });
          savedSelection = newSelection;
        } else {
          savedSelection = lastSelection;
        }

        if (newSelection !== undefined && newSelection.x0 !== undefined && newSelection.x1 !== undefined) {
          if (navigateEvent !== undefined) {
            // console.debug('! navigate select event: ', plot.value, newSelection.x0, newSelection.x1)
            navigateEvent.value = { "x0": newSelection.x0, "x1": newSelection.x1 }
          }
        }
      } else if (event === undefined || (x0 === undefined && x1 === undefined && selections !== undefined && selections.length === 0)) {
        const dur = data.value.duration && data.value.duration > defaultDuration ? data.value.duration : defaultDuration;
        let x1 = dur;
        if (scrollControl?.value?.x1 !== undefined) {
          x1 = scrollControl.value.x1;
        }
        if (x1 === undefined) {
          x1 = defaultDuration;
        }

        const newLayout = initLayout;
        let x0 = 0;
        if (scrollControl?.value?.x0 !== undefined) {
          x0 = scrollControl.value.x0;
        }
        newLayout.xaxis.range = [x0, x1];
        Plotly.relayout(plot.value, {...newLayout, selections: []});
        savedRange = [x0, x1];
        Plotly.restyle(plot.value, { selectedpoints: [null] });
        savedSelection = null;

        if (resetEvents !== undefined) {
          console.debug('! reset event: ', plot.value, x0, x1);
          resetEvents.forEach(resetEvent => {
            resetEvent.value = { "x0": x0, "x1": x1, "event": "reset" };
          })
        }
      }
    });
  });

  watch(data, d => {
    Plotly.react(plot.value, d.traces);
    if (!preventDataChangeNavigation) {
      console.debug('! data changed relayout: ', plot.value, d, d.duration, defaultDuration);
      if (useDefaultDuration) {
        Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [0, defaultDuration] } });
      } else {
        const newDuration = d.duration && d.duration > defaultDuration ? d.duration : defaultDuration;
        Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [0, newDuration] } });
      }
    } else {
      console.debug('! data changed relayout without navigation: ', plot.value, d, d.duration, defaultDuration, savedRange);
      Plotly.relayout(plot.value, { ...initLayout, xaxis: {...defaultLayout.xaxis, range: savedRange} });
    }
  });

  if (scrollControl !== undefined) {
    watch(scrollControl, track => {
      if (track?.event === 'reset') {
        if (useDefaultDuration) {
          console.debug('! control reset default duration: ', plot.value, track.x0, track.x1);
          Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [0, defaultDuration] } })
          savedRange = [0, defaultDuration];
        } else {
          console.debug('! control reset: ', plot.value, track.x0, track.x1);
          Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [track.x0, track.x1] } })
          savedRange = [track.x0, track.x1];
        }
      } else {
        if (savedSelection !== null) {
          console.debug('! control navigate selection: ', plot.value, track.x0, track.x1, savedSelection);
          Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [track.x0, track.x1] }, selections: [savedSelection] });
          savedRange = [track.x0, track.x1];
        } else {
          console.debug('! control navigate: ', plot.value, track.x0, track.x1);
          Plotly.relayout(plot.value, { ...initLayout, xaxis: { ...initLayout.xaxis, range: [track.x0, track.x1] } })
          savedRange = [track.x0, track.x1];
        }
      }
    })
  }

  if (navigateControl !== undefined) {
    watch(navigateControl, track => {
      console.debug('! navigateControl: ', plot.value, track, savedSelection);

      // const navigateRect = {
      //   line: {
      //     width: 0,
      //   },
      //   type: "rect",
      //   xref: "x",
      //   x0: n.x0,
      //   y0: yaxisRange[0],
      //   yref: "y",
      //   x1: n.x1,
      //   y1: yaxisRange[1],
      //   fillcolor: '#d3d3d3',
      //   opacity: 0.5,
      // };
      // Plotly.relayout(plot.value, { shapes: [navigateRect] });

      if (savedSelection === null) {
        return
      }
      Plotly.relayout(plot.value, {
        ...initLayout,
        xaxis: { ...initLayout.xaxis, range: [0, data.value.duration] },
        selections: [{
          line: { width: 1, dash: 'dot' },
          opacity: undefined,
          type: "rect",
          x0: track.x0,
          // x1: props.audioSource?.duration ?? x1,
          x1: track.x1,
          xref: "x",
          y0: yaxisRange[0],
          y1: yaxisRange[1],
          yref: "y",
        }]
      });
    })
  }

  // if (position !== undefined) {
  //   watch(position, (p) => {
  //     const verticalLine = {
  //       line: { color: colors.orange.darken2, width: 2 },
  //       type: "line",
  //       x0: p,
  //       x1: p,
  //       xref: "x",
  //       y0: yaxisRange[0],
  //       y1: yaxisRange[1],
  //       yref: "y",
  //     };
  //     Plotly.relayout(plot.value, { shapes: [verticalLine] });
  //   })
  // }
}

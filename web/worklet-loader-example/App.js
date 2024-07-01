// import workletUrl from 'worklet-loader!./Worklet.js';

import workletUrl from './file.worklet.js';

const audioCtx = new AudioContext();

audioCtx.audioWorklet.addModule(workletUrl).then(() => {
  // Do stuff with the now-registered processor
});
